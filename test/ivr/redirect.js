const expect = require('expect.js')
const ivrTarget = require('../../ivr/redirect')
const app = require('../../ivr/common')
app.use(ivrTarget)
const request = require('supertest')(app);

const {Callee, Campaign, Redirect} = require('../../models');

describe('/redirect', () => {
  beforeEach(require('../test_helper').dropFixtures);

  const call_uuid = '111';
  const payload = {CallUUID: call_uuid, To: '041111', From: '0468111111'};
  context('without a campaign id', () => {
    it('should raise an error', async() => {
      await request.post(`/redirect`)
        .type('form').send(payload)
        .expect(500)
        .expect(/No campaign ID set on 041111/);
    });
  });

  context('without a target number set', () => {
    let campaign;
    beforeEach(async() => { campaign = await Campaign.query().insert({name: 'test'}) })
    it('should raise an error', async() => {
      await request.post(`/redirect?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(500)
        .expect(new RegExp(`No target number set on campaign: ${campaign.id}`))
    })
  })

  context('with a campaign with a target number', () => {
    let campaign;
    beforeEach(async() => { campaign = await Campaign.query().insert({name: 'test', target_numbers: ['0290000000']}) })

    it('should redirect to the target number', async() => {
      await request.post(`/redirect?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200)
        .expect(new RegExp(campaign.target_numbers[0]))
    })

    it('should record a redirect', async() => {
      await request.post(`/redirect?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200)
      expect(await Redirect.query().where({
        campaign_id: campaign.id, phone_number: payload.From, redirect_number: payload.To,
        target_number: campaign.target_numbers[0], call_uuid
      }).first()).to.be.a(Redirect);
    })

    context('with a phone number matching a callee in the campaign', () => {
      it('should add the caller id', async() => {
        const callee = await Callee.query().insert({phone_number: '61468111111', campaign_id: campaign.id})
        await request.post(`/redirect?campaign_id=${campaign.id}`)
          .type('form').send(payload)
          .expect(200)
        expect(await Redirect.query().where({
          campaign_id: campaign.id, phone_number: payload.From, redirect_number: payload.To,
          target_number: campaign.target_numbers[0], call_uuid,
          callee_id: callee.id
        }).first()).to.be.a(Redirect);
      })
    })
  })
})
