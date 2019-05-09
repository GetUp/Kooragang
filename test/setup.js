const expect = require('expect.js')
const nock = require('nock')
const { plivo_setup_campaigns } = require('../campaigns/plivo_setup')
const { dropFixtures } = require('./test_helper')
const { Campaign } = require('../models');
const sinon = require('sinon')
const EventEmitter = require('events')
const emitter = new EventEmitter()

const defaultCampaign = {
  id: 11,
  name: 'test',
  questions: {},
  number_region: 'Sydney'
}
const questions = require('../seeds/questions.example.json')

const numberSetupCampaign = Object.assign({}, defaultCampaign, { plivo_setup_status: 'needed' })
const audioSetupCampaign = Object.assign({}, defaultCampaign, { text_to_speech_status: 'needed' }, { questions })

xdescribe('plivo_setup_campaigns', () => {
  let searchRentedNumbersCall, createApplicationCall, editRentedNumberCall;
  let campaign;
  let rentedNumbers = [{ region: 'SYDNEY, AUSTRALIA', application: null, number: '61212121212' }, { region: 'SYDNEY, AUSTRALIA', application: null, number: '6131311313' }]
  let rentableNumbers = [{ region: 'SYDNEY, AUSTRALIA', application: null, number: '6141414141414' }]
  const app_id = '12121'
  const fields = { name: 'Test App', intro: { name: "test", audio_filename: { en: 'test.wav' } } }
  const area = { country_iso: 'AU', type: 'local', region: 'Sydney' }
  beforeEach(async () => await dropFixtures())
  beforeEach(async () => campaign = await Campaign.query().insert(numberSetupCampaign));

  context('with no phone_number set on the campaign', () => {

    const shouldSearchForNumbersAndSetupTheApp = ({ updated_number }) => {
      beforeEach(() => {
        searchRentedNumbersCall = nock('https://api.plivo.com')
          .get(/Number/)
          .query(true)
          .reply(200, () => { return { objects: rentedNumbers, meta: { next: null } } })
        createApplicationCall = nock('https://api.plivo.com')
          .post(/Application/, body => {
            return body.app_name === `kooragang-test-${numberSetupCampaign.id}-${numberSetupCampaign.name}` &&
              body.answer_url.match(/https:\/\/test\/connect\?campaign_id=\d+/) &&
              body.fallback_answer_url.match(/https:\/\/test\/log\?event=fallback&campaign_id=\d+/) &&
              body.hangup_url.match(/https:\/\/test\/call_ended\?campaign_id=\d+/)
          })
          .query(true)
          .reply(200, { app_id })
        editRentedNumberCall = nock('https://api.plivo.com')
          .post(new RegExp(`\/Number\/${updated_number}\/`), body => body.app_id === app_id)
          .query(true)
          .reply(200)
      })

      it('should search for rented numbers', async () => {
        await plivo_setup_campaigns()
        searchRentedNumbersCall.done()
      })

      it('should create a plivo app with the name and environment and callbacks', async () => {
        await plivo_setup_campaigns()
        createApplicationCall.done()
      })

      it('should update the campaign with the number', async () => {
        await plivo_setup_campaigns()
        campaign = await campaign.$query()
        expect(campaign.phone_number).to.be(updated_number)
      })

      it('should edit the rented number and update the application ID', async () => {
        await plivo_setup_campaigns()
        editRentedNumberCall.done()
      })

      it('updates plivo_setup_status to complete', async () => {
        await plivo_setup_campaigns()
        campaign = await campaign.$query()
        expect(campaign.plivo_setup_status).to.be('complete')
      })
    }

    context('with free rented numbers available', () => {
      shouldSearchForNumbersAndSetupTheApp({ updated_number: '61212121212' })
    })

    context('with no free rented numbers available', () => {
      let searchRentableNumbersCall, rentNumberCall;
      beforeEach(() => {
        searchRentableNumbersCall = nock('https://api.plivo.com')
          .get(/PhoneNumber/)
          .query(true)
          .reply(200, () => { return { objects: rentableNumbers, meta: { next: null } } });
        rentNumberCall = nock('https://api.plivo.com')
          .post(/PhoneNumber\/6141414141414/)
          .query(true)
          .reply(200);
        rentedNumbers = []
      })

      shouldSearchForNumbersAndSetupTheApp({ updated_number: '6141414141414' })

      it('should search for rentable numbers', async () => {
        await plivo_setup_campaigns()
        searchRentableNumbersCall.done()
      })

      context('with rentable numbers available', () => {
        it('should rent the first number', async () => {
          await plivo_setup_campaigns()
          rentNumberCall.done()
        })
      })

      context('with no rentable numbers available', () => {
        beforeEach(() => rentableNumbers = [])
        it('updates plivo_setup_status to no_numbers_in_region', async () => {
          await plivo_setup_campaigns()
          campaign = await campaign.$query()
          expect(campaign.plivo_setup_status).to.be('no_numbers_in_region')
        })
      })
    })
  })
})
