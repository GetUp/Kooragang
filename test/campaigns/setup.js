const expect = require('expect.js')
const nock = require('nock')
const setup = require('../../campaigns/setup')

const {Campaign, Redirect} = require('../../models');

describe('setup', () => {
  let createApiCall, searchApiCall, rentApiCall;
  let campaign;
  let numbers = [{number: '61212121212'}, {number: '6131311313'}];
  const app_id = '12121'
  const fields = {name: 'Test App', acceptable_drop_rate: 0.01}
  const area = {country_iso: 'AU', type: 'local', region: 'Sydney'}
  beforeEach(require('../util').dropFixtures);
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
      .get(/PhoneNumber/)
      .query(true)
      .reply(200, () => { return { objects: numbers} });
    rentApiCall = nock('https://api.plivo.com')
      .post(/PhoneNumber\/61212121212/, body => body.app_id === app_id)
      .query(true)
      .reply(200);
  })

  it ('should create a campaign using the name and fields', async() => {
    const campaign = await setup(fields, area)
    expect(campaign.name).to.be(fields.name)
    expect(campaign.acceptable_drop_rate).to.be(fields.acceptable_drop_rate)
  })

  it ('should create a plivo app with the name and environment and callbacks', async() => {
    const campaign = await setup(fields, area)
    createApiCall.done()
  })


  it ('should rent the first number', async () => {
    await setup(fields, area)
    rentApiCall.done()
  })

  it ('should update the campaign with the number', async () => {
    const campaign = await setup(fields, area)
    expect(campaign.phone_number).to.be(numbers[0].number)
  })

  context('with a redirect', () => {
    let fieldsForRedirectCampaign = Object.assign({target_number: '6147676767676'}, fields);
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
      rentRedirectApiCall = nock('https://api.plivo.com')
        .post(/PhoneNumber\/6131311313/, body => body.app_id === redirect_app_id)
        .query(true)
        .reply(200);
    })

    it ('should create a redirect app', async () => {
      await setup(fieldsForRedirectCampaign, area)
      createRedirectApi.done()
    })

    it ('should buy a number', async () => {
      await setup(fieldsForRedirectCampaign, area)
      rentRedirectApiCall.done()
    })

    it ('should update the redirect number', async () => {
      const campaign = await setup(fieldsForRedirectCampaign, area)
      expect(campaign.phone_number).to.be(numbers[0].number)
    })
  })

  context('with no numbers available', () => {
    beforeEach(() => numbers = [])
    it ('should throw an error', async() => {
      try {
        await setup(fields, area)
        throw 'should not reach'
      } catch(error) {
        expect(error).to.match(/No numbers available/)
      }
    })
  })
})
