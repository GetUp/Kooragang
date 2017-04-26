const expect = require('expect.js');
const nock = require('nock');
const dialer = require('../../dialer');
const moment = require('moment');
const _ = require('lodash');
const sinon = require('sinon');

const { Callee, Caller, Call, Campaign, Event } = require('../../models');

const defaultCampaign = {
  name: 'test',
  status: 'active',
  max_ratio: 3.0,
  acceptable_drop_rate: 0.05,
  recalculate_ratio_window: 180,
  ratio_window: 600
}

const dropAll = async () => {
  await Event.query().delete();
  await Call.query().delete();
  await Callee.query().delete();
  await Caller.query().delete();
  await Campaign.query().delete();
}

describe('.dial', () => {
  let callee, invalidCallee, campaign;
  const testUrl = 'http://test'
  beforeEach(dropAll);
  beforeEach(async () => {
    campaign = await Campaign.query().insert(defaultCampaign);
    invalidCallee = await Callee.query().insert({phone_number: '9', campaign_id: campaign.id});
    callee = await Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id});
  });

  context('with available callers and callees', () => {
    beforeEach(async () => {
      await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
      await Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id})
    });
    context('with answering machine detection enabled on campaign', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          detect_answering_machine: true
        });
      });
      it('should add the extra dialing params', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => {
            return body.machine_detection === 'hangup';
          })
          .query(true)
          .reply(200);
        await dialer.dial(testUrl, campaign);
        mockedApiCall.done();
      })
    });

    context('with error with an api call', () => {
      it ('should remove decrement the calls_in_progress', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => true)
          .query(true)
          .reply(404);
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.calls_in_progress).to.be(0);
        mockedApiCall.done()
      })
    });
  })

  context('with a predictive ratio dialer campaign', () => {
    let mockedApiCall;
    beforeEach(async () => {
      campaign = await Campaign.query().patchAndFetchById(campaign.id, {dialer: 'ratio', ratio: 1});
    });
    beforeEach(() => {
      mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => body.to === callee.phone_number)
        .query(true)
        .reply(200);
    });

    context('with no calls in the last 10 minutes', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {dialer: 'ratio', ratio: 1.2});
      });

      it('should reset the ratio to 1', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1);
      });

      context('and the ratio was already 1.0', () => {
        beforeEach(async () => campaign = await campaign.$query().patchAndFetchById(campaign.id, {ratio: 1.0}));

        it('should not create an event', async () => {
          await dialer.dial(testUrl, campaign)
          expect((await Event.query()).length).to.be(0);
        })
      })
    });

    context('with no calls since last recalculation', () => {
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, ended_at: moment().subtract(5, 'minutes').toDate()})
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {last_checked_ratio_at: moment().subtract(4, 'minutes').toDate()});
      });
      it('should not recalculate the ratio', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1.0);
      });
    });

    context('with no drops in the last 10 minutes', () => {
      beforeEach(async () => await Call.query().insert({callee_id: callee.id, ended_at: new Date()}))
      it('should increase the calling ratio by the campaign ratio_increment', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1.2);
      });

      context('with the calling ratio at the max', () => {
        beforeEach(async () => {
          campaign = await Campaign.query().patchAndFetchById(campaign.id, {ratio: campaign.max_ratio});
        });
        it('should not increase the calling ratio', async () => {
          await dialer.dial(testUrl, campaign);
          const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
          expect(updatedCampaign.ratio).to.be(campaign.max_ratio);
        });
      });
    });

    context('drops in the last 10 minutes over an acceptable ratio', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: campaign.max_ratio
        });
      });
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, dropped: true, ended_at: new Date()})
      });
      it('should decrease the calling ratio using the ratio_decrease_factor', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(campaign.max_ratio - campaign.ratio_increment * campaign.ratio_decrease_factor);
      });
    });

    context('drops in the last 10 minutes under an acceptable ratio', () => {
      let currentRatio;
      beforeEach(async () => {
        currentRatio = campaign.max_ratio - 1;
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: currentRatio
        });
      });
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, dropped: true, ended_at: new Date()})
        const inserts = _.range(100).map(() => Call.query().insert({callee_id: callee.id, status: 'completed', ended_at: new Date()}));
        await Promise.all(inserts);
      });
      it('should increase the calling ratio', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(currentRatio + 0.2);
      });

      it('should create an event', async () => {
        await dialer.dial(testUrl, campaign)
        const event = await Event.query().where({campaign_id: campaign.id, name: 'ratio'}).first();
        expect(event).to.be.an(Event);
        expect(event.value).to.be('{"ratio":"2.2","old_ratio":2}');
      });
    });

    context('with a recent adjustment to the dialer in the last 3 mins', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: campaign.max_ratio - 1,
          last_checked_ratio_at: moment().subtract(2, 'minutes').toDate()
        });
      });
      it('should make no further adjustments', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(campaign.max_ratio - 1);
      });
    });

    context('with a called callee', () => {
      let calledCallee, uncalledCallee
      beforeEach(async () => {
        await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})
        await Callee.query().delete()
        calledCallee   = await Callee.query().insert({id: 1, call_attempts: 1, campaign_id: campaign.id, phone_number: 1}).returning('*')
        uncalledCallee = await Callee.query().insert({id: 2, call_attempts: 0, campaign_id: campaign.id, phone_number: 1}).returning('*')
      })

      context('with exhaust_callees_before_recycling == false', () => {
        beforeEach(async () => {
          campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: false})
        })

        it('should call callees prioritised by their id', async () => {
          await dialer.dial(testUrl, campaign)
          expect((await calledCallee.$query()).last_called_at).to.not.be(null)
          expect((await uncalledCallee.$query()).last_called_at).to.be(null)
        })
      })

      context('with exhaust_callees_before_recycling == true', () => {
        beforeEach(async () => {
          campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: true})
        })

        it('should call callees prioritised by lowest call count', async () => {
          await dialer.dial(testUrl, campaign)
          expect((await calledCallee.$query()).last_called_at).to.be(null)
          expect((await uncalledCallee.$query()).last_called_at).to.not.be(null)
        })
      })
    })

    context('with 2 available agents and ratio of 2', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 3, max_ratio: 4, last_checked_ratio_at: new Date()
        });
        await Promise.all(_.range(2).map(() => Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})));
      });
      beforeEach(async () => {
        const inserts = _.range(4).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });
      it('should initiate available agents * ratio calls', async () => {
        mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(4)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        mockedApiCall.done()
      });

      it('should record an event', async () => {
        mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(4)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        const event = await Event.query().where({campaign_id: campaign.id, name: 'calling'}).first();
        expect(event).to.be.an(Event);
        expect(event.value).to.match(/callsToMake/);
      });
    });

    context('with 2 available agents and of 1.2', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 1.2, max_ratio: 4, last_checked_ratio_at: new Date()
        });
        await Promise.all(_.range(2).map(() => Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})));
      });
      beforeEach(async () => {
        await Callee.query().delete();
        const inserts = _.range(4).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });

      it('should initiate two calls', async () => {
        mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(2)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        mockedApiCall.done()
      });
    });

    context('with more calls in progress than available callers', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 1, max_ratio: 4, last_checked_ratio_at: new Date(), calls_in_progress: 6
        });
        await Callee.query().delete();
        const inserts = _.range(8).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });

      it('should not make any calls', async () => {
        await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
        await Caller.query().insert({phone_number: '2', status: 'available', campaign_id: campaign.id});
        await dialer.dial(testUrl, campaign);
      });
    });

    context('with calls in progress', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 1, max_ratio: 4, last_checked_ratio_at: new Date(), calls_in_progress: 0
        });
      });
      beforeEach(async () => {
        await Callee.query().delete();
        const inserts = _.range(8).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });

      it('should exclude calls in progress from the number of calls to make', async () => {
        let calls_in_progress;
        let counter = 0;
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(4)
          .reply(200);
        await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
        await Caller.query().insert({phone_number: '2', status: 'available', campaign_id: campaign.id});
        await Caller.query().insert({phone_number: '3', status: 'available', campaign_id: campaign.id});
        await dialer.dial(testUrl, campaign);
        campaign = await dialer.decrementCallsInProgress(campaign);
        expect(campaign.calls_in_progress).to.be(2);
        await dialer.dial(testUrl, campaign);
        mockedApiCall.done()
      });
    });

    context('with 2 available agents and of 1.6', () => {
      beforeEach(async () => {
        await Promise.all(_.range(2).map(() => Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})));
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 1.6, max_ratio: 4, last_checked_ratio_at: new Date(), calls_in_progress: 0
        });
      });
      beforeEach(async () => {
        await Callee.query().delete();
        const inserts = _.range(4).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
      });

      it('should initiate three calls', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(3)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        mockedApiCall.done()
      });
    });
  });
});

describe('.calledEveryone', () => {
  let campaign;
  beforeEach(dropAll);
  beforeEach(async () => {
    campaign = await Campaign.query().insert({name: 'test'});
  });

  context('with no available callees on the current campaign', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', last_called_at: new Date(), campaign_id: campaign.id}));
    beforeEach(async () => {
      const anotherCampaign = await Campaign.query().insert({name: 'another'});
      Callee.query().insert({phone_number: '123456789', campaign_id: anotherCampaign.id});
    });
    it('should return true', async () => expect(await dialer.calledEveryone(campaign)).to.be(true));

    context('with calls_in_progress > 0', () => {
      beforeEach(async() => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {calls_in_progress: 1});
      });
      it('should return false', async () => expect(await dialer.calledEveryone(campaign)).to.be(false));
    })
  });
  context('with available callees', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id}));
    it('should return false', async () => expect(await dialer.calledEveryone(campaign)).to.be(false));
  });
});