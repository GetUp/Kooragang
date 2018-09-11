const app = require('express')();
const plivo = require('plivo');
const {Callee, Campaign, Redirect} = require('../models');

app.post('/redirect', async ({body, query}, res, next) => {
  const r = plivo.Response();
  let callee;
  if (!query.campaign_id) return next(`No campaign ID set on ${body.To}`);
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const target_number = _.isArray(campaign.target_numbers) ? _.sample(campaign.target_numbers) : campaign.target_numbers
  if (!target_number) return next(`No target number set on campaign: ${campaign.id}`);
  r.addDial().addNumber(target_number);
  if (body.From.match(/\d+/)) {
    callee = await Callee.query().where({campaign_id: campaign.id, phone_number: body.From.replace(/^0/, '61')}).first();
  }
  await Redirect.query().insert({
    campaign_id: campaign.id,
    phone_number: body.From,
    redirect_number: body.To,
    target_number,
    call_uuid: body.CallUUID,
    callee_id: callee && callee.id
  })
  res.send(r.toXML());
});

module.exports = app;

