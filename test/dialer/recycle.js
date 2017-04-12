const expect = require('expect.js');
const recycle = require('../../dialer/recycle');
const {Campaign, Callee, Call, Caller} = require('../../models');
const moment = require('moment');

describe('dialer/recycle', () => {
  beforeEach(async() => {
    await Call.query().delete();
    await Callee.query().delete();
    await Caller.query().delete();
    await Campaign.query().delete();
  });

  context('with a campaign with max_call_attempts set to 1 (no recycle)', () => {
    let campaign, callee;
    beforeEach(async() => campaign = await Campaign.query().insert({name: 'test', max_call_attempts: 1}));

    context('with a callee called over 4 hours ago', () => {
      beforeEach(async() => callee = await Callee.query().insert({campaign_id: campaign.id, last_called_at: moment().subtract(5, 'hours').toDate()}));

      context('with the call busy or no-answer', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'no-answer'}));
        it ('should NOT reset the last_called_at or set the last_recycled_at', async() => {
          await recycle();
          const updatedCallee = await Callee.query().first();
          expect(updatedCallee.last_called_at).to.not.be(null);
          expect(updatedCallee.last_recycled_at).to.be(null);
        });
      });
    });
  });

  context('with a campaign with max_call_attempts set to greater than 1 (recycle)', () => {
    let campaign, callee;
    beforeEach(async() => campaign = await Campaign.query().insert({name: 'test', max_call_attempts: 2}));

    context('with a callee called over 4 hours ago', () => {
      beforeEach(async() => callee = await Callee.query().insert({campaign_id: campaign.id, last_called_at: moment().subtract(5, 'hours').toDate()}));

      context('with the call busy or no-answer', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'no-answer'}));
        it ('should reset the last_called_at and set the last_recycled_at', async() => {
          await recycle();
          const updatedCallee = await Callee.query().first();
          expect(updatedCallee.last_called_at).to.be(null);
          expect(updatedCallee.last_recycled_at).to.not.be(null);
        });
      });

      context('with the call completed', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'completed'}));
        it ('should NOT reset the last_called_at', async() => {
          await recycle();
          const updatedCallee = await Callee.query().first();
          expect(updatedCallee.last_called_at).to.not.be(null);
        });
      });

      context('with max_call_attempts already made with status', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'busy'}));
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'busy'}));
        it ('should NOT reset the last_called_at', async() => {
          await recycle();
          const updatedCallee = await Callee.query().first();
          expect(updatedCallee.last_called_at).to.not.be(null);
        });

        it('sets the number of calls attempts made', async() => {
          await recycle();
          const updatedCallee = await Callee.query().first();
          expect(updatedCallee.call_attempts).to.be(2);
        })
      });
    });
  });
});
