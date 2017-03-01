const expect = require('expect.js');
const nock = require('nock');
const dialer = require('../dialer');

const { Callee } = require('../models');

describe('dialer', () => {
  context('with available callees', () => {
    let callee, invalidCallee;
    beforeEach(async () => Callee.query().delete());
    beforeEach(async () => {
      invalidCallee = await Callee.query().insert({phone_number: '9'});
      callee = await Callee.query().insert({phone_number: '123456789'});
    });

    it('should call the first one with a valid number', async () => {
      mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => body.to === callee.phone_number)
        .query(true)
        .reply(200);
      await dialer.dial();
      mockedApiCall.done();
    });
  });
});
