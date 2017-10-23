const expect = require('expect.js')
const nock = require('nock')
const { setup_inbound, setup_redirect } = require('../../campaigns/plivo_setup')

const { Campaign, Redirect } = require('../../models');

describe('setup', () => {
  let createApiCall, searchApiCall, linkApiCall;
  let campaign;
  let numbers = [{region: 'SYDNEY, AUSTRALIA', application: null, number: '61212121212'}, {region: 'SYDNEY, AUSTRALIA', application: null, number: '6131311313'}];
  const app_id = '12121'
  const fieldsForInboundCampaign = {name: 'Test App', number_region: 'Sydney'}
  beforeEach(require('../test_helper').dropFixtures);
  beforeEach(() => {
    createApiCall = nock('https://api.plivo.com')
      .post(/Application/, body => {
        return body.app_name === 'kooragang-test-test_app' &&
          body.answer_url.match(/https:\/\/test\/connect\?campaign_id=\d+/) &&
          body.fallback_answer_url.match(/https:\/\/test\/log\?event=fallback&campaign_id=\d+/) &&
          body.hangup_url.match(/https:\/\/test\/call_ended\?campaign_id=\d+/)
      })
      .query(true)
      .reply(200, {app_id});
    searchApiCall = nock('https://api.plivo.com')
      .get(/Number/)
      .query(true)
      .reply(200, () => { return { objects: numbers, meta: {next: null}} });
    linkApiCall = nock('https://api.plivo.com')
      .post(/Number\/61212121212/, body => body.app_id === app_id)
      .query(true)
      .reply(200);
  })
  beforeEach(async () => { campaign = await Campaign.query().insert(fieldsForInboundCampaign) })

  it ('should create a plivo app with the name and environment and callbacks', async() => {
    await setup_inbound(campaign)
    createApiCall.done()
  })

  it ('should link the first number', async () => {
    await setup_inbound(campaign)
    linkApiCall.done()
  })

  it ('should update the campaign with the number', async () => {
    await setup_inbound(campaign)
    expect(campaign.phone_number).to.be(numbers[0].number)
  })

  context('with a redirect', () => {
    let fieldsForRedirectCampaign = Object.assign({target_number: '6147676767676'}, fieldsForInboundCampaign);
    const redirect_app_id = '89989'
    beforeEach( async () => {
      createRedirectApi = nock('https://api.plivo.com')
        .post(/Application/, body => {
          return body.app_name === 'kooragang-test-test_app-redirect' &&
            body.answer_url.match(/https:\/\/test\/redirect\?campaign_id=\d+/) &&
            body.fallback_answer_url.match(/https:\/\/test\/log\?event=redirect_fallback&campaign_id=\d+/) &&
            body.hangup_url.match(/https:\/\/test\/log\?event=redirect_hangup&campaign_id=\d+/)
        })
        .query(true)
        .reply(200, {app_id: redirect_app_id});
      linkRedirectApiCall = nock('https://api.plivo.com')
        .post(/Number\/61212121212/, body => body.app_id === redirect_app_id)
        .query(true)
        .reply(200);
    })
    beforeEach(async () => {
      await Campaign.query().delete()
      campaign = await Campaign.query().insert(fieldsForRedirectCampaign)
    })

    it ('should create a redirect app', async () => {
      await setup_redirect(campaign)
      createRedirectApi.done()
    })

    it ('should link a number', async () => {
      await setup_redirect(campaign)
      linkRedirectApiCall.done()
    })

    it ('should update the redirect number', async () => {
      await setup_redirect(campaign)
      expect(campaign.redirect_number).to.be(numbers[0].number)
    })
  })

  context('with no numbers available', () => {
    beforeEach(() => numbers = [{region: 'MELBOURNE, AUSTRALIA', application: null, number: '6131311313'}, {region: 'SYDNEY, AUSTRALIA', application: '/app/exists', number: '61212121212'}])

    it ('should throw an error', async() => {
      try {
        await setup_inbound(campaign)
        throw 'should not reach'
      } catch(error) {
        expect(error).to.match(/No numbers available/)
      }
    })
  })
})
