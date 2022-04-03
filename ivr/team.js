const app = require('express')()
const plivo = require('plivo')
const { User, Team, Event } = require('../models')

app.post('/team', async ({query, body}, res) => {
  const r = plivo.Response()
  r.addWait({length: 1})

  let user = await User.query().where({phone_number: body.From}).first()
  if (!user) { user = await User.query().insert({phone_number: body.From}) }

  if (user.team_id && body.Digits === '1') {
    const team = await Team.query().where({id: user.team_id}).first()
    await user.$query().patch({last_joined_at: new Date()})
    await Event.query().insert({name: 'team join existing', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    r.addSpeakI18n('rejoined_team', {team_name: team.name})
    r.addRedirect(res.locals.plivoCallbackUrl(`connect?campaign_id=${query.campaign_id}&team=1&assessment=${query.assessment ? '1' : '0'}&number=${query.number}`))
    return res.send(r.toXML())
  }

  if (user && body.Digits === '2') {
    await Event.query().insert({name: 'team selection', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    const code_prompt = r.addGetDigits({
      action: res.locals.plivoCallbackUrl(`team/join?campaign_id=${query.campaign_id}&user_id=${user.id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}&assessment=${query.assessment ? '1' : '0'}&number=${query.number}`),
      timeout: 10,
      retries: 10,
      numDigits: 4
    })
    code_prompt.addSpeakI18n('enter_passcode')
    return res.send(r.toXML())
  }

  await user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: null})
  await Event.query().insert({name: 'team join opt out', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
  r.addSpeakI18n('no_team')
  r.addRedirect(res.locals.plivoCallbackUrl(`connect?campaign_id=${query.campaign_id}&team=1&assessment=${query.assessment ? '1' : '0'}&number=${query.number}`))
  res.send(r.toXML())
})

app.post('/team/join', async ({query, body}, res) => {
  const r = plivo.Response()
  const team = await Team.query().where({passcode: body.Digits}).first()
  if (team) {
    const user = await User.query().findById(query.user_id).first()
    await Event.query().insert({name: 'team join new', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
    await user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: team.id})
    r.addWait({length: 1})
    r.addSpeakI18n('joined_team', {team_name: team.name})
    r.addWait({length: 1})
    r.addRedirect(res.locals.plivoCallbackUrl(`connect?campaign_id=${query.campaign_id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}&team=1&assessment=${query.assessment ? '1' : '0'}&number=${query.number}`))
    return res.send(r.toXML())
  }
  await Event.query().insert({name: 'team join incorrect passcode', campaign_id: query.campaign_id, value: {log_id: query.log_id}})
  r.addWait({length: 1})
  r.addSpeakI18n('incorrect_passcode')
  r.addWait({length: 1})
  r.addRedirect(res.locals.plivoCallbackUrl(`connect?campaign_id=${query.campaign_id}&assessment=${query.assessment ? '1' : '0'}&number=${query.number}`))
  res.send(r.toXML())
})

module.exports = app
