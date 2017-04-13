const app = require('express')();
const plivo = require('plivo');
const {validPasscode} = require('../utils');

app.post('/passcode', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const authenticatedCaller = validPasscode(campaign.passcode, body.Digits);

  if (authenticatedCaller) {
    r.addWait({length: 1});
    r.addSpeakAU('Thanks for that.')
    r.addWait({length: 1});
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${campaign.id}&authenticated=1`));
    return res.send(r.toXML());
  }

  r.addWait({length: 1});
  r.addSpeakAU('You have entered the incorrect passcode. Please call back and try again.')
  r.addWait({length: 1});
  r.addHangup();
  res.send(r.toXML());
});

module.exports = app;
