const app = require('express')()
const plivo = require('plivo')
const {Campaign, Caller, User, Team, Event} = require('../models')

app.post('/team', async ({query, body}, res) => {
  const r = plivo.Response()
  const caller = await Caller.query().where({id: query.caller_id}).first()
  const user = await User.query().where({phone_number: body.From}).first()
  let valid_team_digits = ['2', '*']
  if (user && user.team_id) { valid_team_digits.push('1') }
  const teamAction = r.addGetDigits({
    action: res.locals.appUrl(`team/prompt?campaign_id=${query.campaign_id}&caller_id=${caller.id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}`),
    timeout: 10,
    retries: 10,
    numDigits: 1,
    validDigits: valid_team_digits
  })
  if (user && user.team_id) {
    r.addWait({length: 2})
    const team = await Team.query().where({id: user.team_id}).first()
    teamAction.addSpeakAU(`Press the one key to resume your membership to the ${team.name} calling team`)
    teamAction.addWait({length: 1})
    teamAction.addSpeakAU('Press the two key if you\'re joining a new team.')
  } else {
    teamAction.addSpeakAU('Press the two key on your keypad if you\'re a member of a calling team.')
  }
  teamAction.addWait({length: 1})
  teamAction.addSpeakAU('Otherwise to continue without a team press the star key.')
  r.addSpeakAU('No key pressed. Hanging up now')
  res.send(r.toXML())
})

app.post('/team/prompt', async ({query, body}, res) => {
  const r = plivo.Response()
  r.addWait({length: 1})

  const caller = await Caller.query().where({id: query.caller_id}).first()
  let user = await User.query().where({phone_number: caller.phone_number}).first()
  if (!user) { user = await User.query().insert({phone_number: body.From}) }

  if (user.team_id && body.Digits === '1') {
    const team = await Team.query().where({id: user.team_id}).first();
    await user.$query().patch({last_joined_at: new Date()})
    await caller.$query().patch({team_id: team.id})
    await Event.query().insert({name: 'team join existing', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    r.addSpeakAU(`Thanks for that, you\'ve rejoined team ${team.name}.`)
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&caller_id=${caller.id}&team=1`))
    return res.send(r.toXML())
  }

  if (user && body.Digits === '2') {
    await Event.query().insert({name: 'team selection', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    r.addSpeakAU('Please enter in your teams passcode on your keypad now.')
    const teamAction = r.addGetDigits({
      action: res.locals.appUrl(`team/join?campaign_id=${query.campaign_id}&caller_id=${caller.id}&user_id=${user.id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}`),
      timeout: 10,
      retries: 10,
      numDigits: 4
    })
    return res.send(r.toXML())
  }

  await user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: null})
  await Event.query().insert({name: 'team join opt out', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
  r.addSpeakAU('Thanks for that, you\'re calling without a team this time.')
  r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&caller_id=${caller.id}&team=1`))
  res.send(r.toXML())
})

app.post('/team/join', async ({query, body}, res) => {
  const r = plivo.Response()
  const caller = await Caller.query().where({id: query.caller_id}).first()
  const team = await Team.query().where({passcode: body.Digits}).first()
  if (team) {
    const user = await User.query().findById(query.user_id).first()
    await Event.query().insert({name: 'team join new', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    await user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: team.id})
    r.addWait({length: 1})
    r.addSpeakAU(`Thanks for that, you\'ve joined team ${team.name}.`)
    r.addWait({length: 1})
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&caller_id=${caller.id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}&team=1`))
    return res.send(r.toXML())
  }
  await Event.query().insert({name: 'team join incorrect passcode', campaign_id: query.campaign_id, caller_id: caller.id, value: {log_id: query.log_id}})
  r.addWait({length: 1})
  r.addSpeakAU('You have entered an incorrect team passcode. Please try again.')
  r.addWait({length: 1})
  r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&caller_id=${caller.id}`))
  res.send(r.toXML())
})

module.exports = app
