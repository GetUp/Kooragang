const expect = require('expect.js')
const moment = require('moment')
const { Campaign } = require('../models')
const { withinDailyTimeOfOperation, dailyTimeOfOperationInWords } = require('../utils')

describe('withinDailyTimeOfOperation', () => {
  let campaign
  context('with a campaign active right now', () => {
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'current campaign',
        daily_start_operation: moment().subtract(10, 'm').format('HH:mm:ss'),
        daily_stop_operation: moment().add(10, 'm').format('HH:mm:ss'),
      }).returning('*')
    })
    it('returns true', () => {
      expect(withinDailyTimeOfOperation(campaign)).to.be(true)
    })
  })
  context('with a campaign not active now', () => {
    beforeEach(async () => {
      campaign = await Campaign.query().insert({
        name: 'future campaign',
        daily_start_operation: moment().add(10, 'm').format('HH:mm:ss'),
        daily_stop_operation: moment().add(20, 'm').format('HH:mm:ss'),
      }).returning('*')
    })
    it('returns false', () => {
      expect(withinDailyTimeOfOperation(campaign)).to.be(false)
    })
  })
})

describe('dailyTimeOfOperationInWords', () => {
  context('with an on-the-hour time', () => {
    const campaign = {
      daily_start_operation: '09:00',
      daily_stop_operation: '20:00',
    }
    const string = dailyTimeOfOperationInWords(campaign)

    it('returns human time', () => {
      expect(string).to.match(/9 am/)
      expect(string).to.match(/8 pm/)
    })
  })

  context('with a specific time', () => {
    const campaign = {
      daily_start_operation: '09:15:00',
      daily_stop_operation: '19:30:00',
    }
    const string = dailyTimeOfOperationInWords(campaign)

    it('returns human time', () => {
      expect(string).to.match(/9 15 am/)
      expect(string).to.match(/7 30 pm/)
    })
  })

  context('with boundary times', () => {
    const campaign = {
      daily_start_operation: '00:00',
      daily_stop_operation: '24:00',
    }
    const string = dailyTimeOfOperationInWords(campaign)

    it('returns human time', () => {
      expect(string).to.match(/12 am/)
      expect(string).to.match(/12 am/)
    })
  })
})
