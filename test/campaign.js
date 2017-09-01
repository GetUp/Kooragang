const expect = require('expect.js')
const moment = require('../api/moment')
const { Campaign } = require('../models')
const hours_of_operation_full_json = require('../seeds/hours_of_operation_full.example.json');
const hours_of_operation_null_json = require('../seeds/hours_of_operation_null.example.json');

describe('withinDailyTimeOfOperation', () => {
  beforeEach(async () => {
    await Campaign.query().delete();
  })

  let campaign
  context('with a campaign active right now', () => {
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'current campaign',
        hours_of_operation: hours_of_operation_full_json
      }).returning('*')
    })
    it('returns true', () => {
      expect(campaign.isWithinDailyTimeOfOperation()).to.be(true)
    })
  })
  context('with a campaign not active now', () => {
    let campaign
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'future campaign',
        hours_of_operation: hours_of_operation_null_json
      }).returning('*')
    })
    it('returns false', () => {
      expect(campaign.isWithinDailyTimeOfOperation()).to.be(false)
    })
  })
})

describe('dailyTimeOfOperationInWords', () => {
  beforeEach(async () => {
    await Campaign.query().delete();
  })

  context('with an on-the-hour time', () => {
    let campaign
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'campaign',
        hours_of_operation: hours_of_operation_full_json
      })
    })
    it('returns human time', () => {
      const string = campaign.dailyTimeOfOperationInWords()
      expect(string).to.match(/12 am, and 12 am/)
    })
  })

  context('with campaign set hours of operation timezone', () => {
    let campaign
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'campaign',
        hours_of_operation: hours_of_operation_full_json,
        hours_of_operation_timezone: 'Australia/Perth'
      })
    })
    it('returns AWST in words', () => {
      const string = campaign.dailyTimeOfOperationInWords()
      expect(string).to.match(/Australian Western Standard Time/)
    })
  })
})
