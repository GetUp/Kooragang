const app = require('express')()
const plivo = require('plivo')
const {Campaign, User, Team, Log} = require('../models')

app.post('/team', async ({query, body}, res) => {
  let user = await User.query().where({phone_number: body.From}).first()
  if (!user) { user = await User.query().insert({phone_number: body.From}) }
  const team = await Team.query().findById(user.team_id).first()
  const r = plivo.Response()
  r.addWait({length: 1})

  if (body.Digits === '1') {
    user.$query().patch({last_joined_at: new Date()})
    r.addSpeakAU(`Thanks for that, you\'ve rejoined team ${team.name}.`)
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&team=1`))
    return res.send(r.toXML())
  }

  if (body.Digits === '2') {
    r.addSpeakAU('Please enter in your teams passcode on your keypad now.')
    const teamAction = r.addGetDigits({
      action: res.locals.appUrl(`team/join?campaign_id=${query.campaign_id}&user_id=${user.id}`),
      timeout: 10,
      retries: 10,
      numDigits: 4
    })
    return res.send(r.toXML())
  }

  await user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: null})
  r.addSpeakAU('Thanks for that, you\'re running solo this time.')
  r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&team=0`))
  res.send(r.toXML())
})

app.post('/team/join', async ({query, body}, res) => {
  const r = plivo.Response()
  const team = await Team.query().where({passcode: body.Digits}).first()
  if (team) {
    const user = await User.query().findById(query.user_id).first()
    user.$query().patch({last_joined_at: new Date(), updated_at: new Date(), team_id: team.id})
    r.addWait({length: 1})
    r.addSpeakAU(`Thanks for that, you\'ve joined team ${team.name}.`)
    r.addWait({length: 1})
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}&team=1`))
    return res.send(r.toXML())
  }
  r.addWait({length: 1})
  r.addSpeakAU('You have entered an incorrect team passcode. Please try again.')
  r.addWait({length: 1})
  r.addRedirect(res.locals.appUrl(`connect?campaign_id=${query.campaign_id}`))
  res.send(r.toXML())
})

module.exports = app
