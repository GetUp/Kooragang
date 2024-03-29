const expect = require('expect.js')
const {
  extractDialInNumber, sipFormatNumber
} = require('../utils')

describe('extractDialInNumber', () => {
  context('with a sip number', () => {
    const payload = {
      Direction: 'outbound',
      From: '61285994346',
      campaign_id: '2',
      number: '61413877188',
      To: 'sip:61413877188@sip.au.didlogic.net',
      callback: '1',
      'SIP-H-To': '<sip:61413877188@sip.au.didlogic.net>;tag=as25a8f2bb',
    }

    it('extracts the number', (done) => {
      expect(extractDialInNumber(payload)).to.eql('61413877188')
      done()
    })
  })
})

describe('sipFormatNumber', () => {
  context('with a number with non-digit characters', () => {
    it('should strip them out', () => {
      expect(sipFormatNumber('+614 53453 3453')).to.eql('614534533453')
    })
  })
})
