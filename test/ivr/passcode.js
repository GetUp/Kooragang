const expect = require('expect.js')
const nock = require('nock')
const proxyquire = require('proxyquire')
const moment = require('moment')
const ivrCaller = proxyquire('../../ivr/passcode', {
  '../dialer': {
    dial: async (appUrl) => {}
  }
})
const app = require('../../ivr/common')
app.use(ivrCaller)
const request = require('supertest')(app)

const {
  Campaign
} = require('../../models')

const authCampaign = {
  id: 1,
  name: 'test',
  phone_number: '1111',
  sms_number: '22222222',
  status: 'active',
  passcode: '1234'
}

describe('/passcode', () => {
  let campaign
  beforeEach(async () => {
    await Campaign.query().delete()
    campaign = await Campaign.query().insert(authCampaign);
  })

  context('with an authenticated campaign', () => {
    context('with a correct passcode entered', () => {
      const payload = {
        Digits: '1234'
      };
      it('should redirect to connect', () => {
        return request.post(`/passcode?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/Thanks for that/)
          .expect(/<Redirect/)
          .expect(/connect/);
      });
    });
    context('with an incorrect passcode entered', () => {
      const payload = {
        Digits: '0000'
      };
      it('should ignore the team input options and announce welcome back', () => {
        return request.post(`/passcode?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/<Hangup/)
          .expect(/incorrect/);
      });
    });
  });
});
