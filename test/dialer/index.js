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
  let callee, campaign;
  const testUrl = 'http://test'
  beforeEach(dropAll);
  beforeEach(async () => {
    campaign = await Campaign.query().insert(defaultCampaign);
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
            return body.machine_detection === 'true'
            && Number.isInteger(parseInt(body.machine_detection_time))
            && body.machine_detection_url.match(/machine_detection/g);
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
    const campaign2 = Object.assign({ name: 'test campaign 2' }, defaultCampaign);
    let mockedApiCall;
    beforeEach(async () => {
      campaign = await Campaign.query().patchAndFetchById(campaign.id, {dialer: 'ratio', ratio: 1});
      await Campaign.query().insert(campaign2);
      await Caller.query().insert({ phone_number: '2', status: 'available', campaign_id: campaign2.id });
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
        expect(event.value).to.be('{"ratio":"2.2","old_ratio":2,"ratio_window":600,"total":101,"drops":1,"calculatedRatio":0.009900990099009901}');
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
      let completedCallee, busyCallee, uncalledCallee
      beforeEach(async () => {
        await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})
        await Call.query().delete()
        await Callee.query().delete()
        completedCallee   = await Callee.query().insert({id: 1, campaign_id: campaign.id, phone_number: 1}).returning('*')
        busyCallee = await Callee.query().insert({id: 2, campaign_id: campaign.id, phone_number: 1}).returning('*')
        uncalledCallee = await Callee.query().insert({id: 3, campaign_id: campaign.id, phone_number: 1}).returning('*')
        await Call.query().insert({callee_id: 1, status: 'complete'})
        await Call.query().insert({callee_id: 2, status: 'busy'})
      })

      context('with exhaust_callees_before_recycling == false', () => {

        context('with the max_call_attempts number more than calls made', () => {
          beforeEach(async () => {
            campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: false, max_call_attempts: 2})
          })

          it('should call callees prioritised by their id not excluding those within max_call_attempts', async () => {
            await dialer.dial(testUrl, campaign)
            expect((await completedCallee.$query()).last_called_at).to.be(null)
            expect((await busyCallee.$query()).last_called_at).to.not.be(null)
            expect((await uncalledCallee.$query()).last_called_at).to.be(null)
          })
        })

        context('with the max_call_attempts number equal to calls made', () => {
          beforeEach(async () => {
            campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: false, max_call_attempts: 1})
          })

          it('should call callees prioritised by their id excluding those outside max_call_attempts', async () => {
            await dialer.dial(testUrl, campaign)
            expect((await completedCallee.$query()).last_called_at).to.be(null)
            expect((await busyCallee.$query()).last_called_at).to.be(null)
            expect((await uncalledCallee.$query()).last_called_at).to.not.be(null)
          })
        })
      })

      context('with exhaust_callees_before_recycling == true', () => {
        beforeEach(async () => {
          campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: true})
        })

        it('should call callees prioritised by lowest call count', async () => {
          await dialer.dial(testUrl, campaign)
          expect((await completedCallee.$query()).last_called_at).to.be(null)
          expect((await busyCallee.$query()).last_called_at).to.be(null)
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
    campaign = await Campaign.query().insert({name: 'test'}).returning('*');
  });

  context('with no available callees on the current campaign', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', last_called_at: new Date(), campaign_id: campaign.id}));
    beforeEach(async () => {
      const anotherCampaign = await Campaign.query().insert({name: 'another'}).returning('*');
      Callee.query().insert({phone_number: '123456789', campaign_id: anotherCampaign.id});
    });
    it('should return true', async () => expect(await campaign.calledEveryone()).to.be(true));

    context('with calls_in_progress > 0', () => {
      beforeEach(async() => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {calls_in_progress: 1});
      });
      it('should return false', async () => expect(await campaign.calledEveryone()).to.be(false));
    })
  });
  context('with available callees', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id}));
    it('should return false', async () => expect(await campaign.calledEveryone()).to.be(false));
  });

  context('with a campaign with max_call_attempts set to 1 (no recycle)', () => {
    beforeEach(async() => campaign = await Campaign.query().insert({name: 'test', max_call_attempts: 1}).returning('*'));

    context('with a callee called over 4 hours ago', () => {
      beforeEach(async() => callee = await Callee.query().insert({campaign_id: campaign.id, last_called_at: moment().subtract(5, 'hours').toDate()}));

      context('with the call busy or no-answer', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'no-answer'}));
        it ('should be true', async() => {
          expect(await campaign.calledEveryone()).to.be(true)
        });
      });
    });
  });

  context('with a campaign with max_call_attempts set to greater than 1 (recycle)', () => {
    beforeEach(async() => campaign = await Campaign.query().insert({name: 'test', max_call_attempts: 2}).returning('*'));

    context('with a callee called over 4 hours ago', () => {
      let callee;
      beforeEach(async() => callee = await Callee.query().insert({campaign_id: campaign.id, last_called_at: moment().subtract(5, 'hours').toDate()}));

      context('with the call busy or no-answer', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'no-answer'}));
        it ('should be false', async() => {
          expect(await campaign.calledEveryone()).to.be(false)
        });
      });

      context('with the call completed', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'completed'}));
        it ('should be true', async() => {
          expect(await campaign.calledEveryone()).to.be(true)
        });

        context('with a prexisting call', () => {
          beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'busy'}));
          it ('should NOT reset the last_called_at', async() => {
            expect(await campaign.calledEveryone()).to.be(true)
          });
        });
      });

      context('with max_call_attempts already made with status', () => {
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'busy'}));
        beforeEach(() => Call.query().insert({callee_id: callee.id, status: 'busy'}));
        it ('should NOT reset the last_called_at', async() => {
            expect(await campaign.calledEveryone()).to.be(true)
        });
      });
    });
  });
});
