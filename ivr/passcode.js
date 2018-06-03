const app = require('express')()
const plivo = require('plivo')
const {Campaign} = require('../models')

app.post('/passcode', async ({query, body}, res) => {
  const r = plivo.Response()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const authenticatedCaller = campaign.passcode === body.Digits

  if (authenticatedCaller) {
    r.addWait({length: 1})
    r.addSpeakI18n('thanks')
    r.addWait({length: 1})
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${campaign.id}&authenticated=1`))
    return res.send(r.toXML())
  }

  r.addWait({length: 1})
  r.addSpeakI18n('incorrect_passcode')
  r.addWait({length: 1})
  r.addHangup()
  res.send(r.toXML())
})

module.exports = app
