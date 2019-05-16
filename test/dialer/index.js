const expect = require('expect.js');
const nock = require('nock');
const dialer = require('../../dialer');
const moment = require('moment');
const _ = require('lodash');
const sinon = require('sinon');

const {dropFixtures} = require('../test_helper')
const { Audience, QueuedCall, Callee, Caller, Call, Campaign, Event, SurveyResult } = require('../../models');

const hours_of_operation_full = require('../../seeds/hours_of_operation_full.example.json');
const hours_of_operation_null = require('../../seeds/hours_of_operation_null.example.json');
const defaultCampaign = {
  id: 2,
  name: 'test',
  status: 'active',
  max_ratio: 3.0,
  acceptable_drop_rate: 0.05,
  recalculate_ratio_window: 180,
  ratio_window: 600,
  hours_of_operation: hours_of_operation_full
}

const insertMinNumberOfCallers = async (campaign) => {
  for (let i of Array(campaign.min_callers_for_ratio)) {
    await Caller.query().insert({campaign_id: campaign.id, status: 'in-call'})
  }
}

describe('.dial', () => {
  let callee, campaign;
  const testUrl = 'http://test'
  beforeEach(async () => {
    await dropFixtures()
    campaign = await Campaign.query().insert(defaultCampaign);
    callee = await Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id});
  });

  context('with available callers and callees', () => {
    beforeEach(async () => {
      await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
      await Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id})
    });

    context('outside the hours of operation', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          hours_of_operation: hours_of_operation_null
        });
      });
      it('should not make any calls', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, true)
          .query(true)
          .reply(200);
        await dialer.dial(testUrl, campaign);
        expect(await Event.query()).to.eql([])
      })
    })

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

    context('with no outgoing_number set on the campaign', () => {
      it('should use the value in the NUMBER environment variable', async () => {
        process.env.NUMBER = '123'
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.from === process.env.NUMBER)
          .query(true)
          .reply(200);
        await dialer.dial(testUrl, campaign);
        mockedApiCall.done();
      })
    });

    context('with an outgoing_number set on the campaign', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {ring_timeout: '99'});
      });
      it('should use the campaign\'s outgoing_number', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.ring_timeout === campaign.ring_timeout)
          .query(true)
          .reply(200);
        await dialer.dial(testUrl, campaign);
        mockedApiCall.done();
      })
    });

    context('with SIP headers set', () => {
      beforeEach(() => process.env.SIP_HEADERS = 'test=test' )
      afterEach(() => delete process.env.SIP_HEADERS )

      context('with a standard number', () => {
        it('should not append SIP headers', async () => {
          const mockedApiCall = nock('https://api.plivo.com')
            .post(/Call/, body => !body.sip_headers)
            .query(true)
            .reply(200);
          await dialer.dial(testUrl, campaign);
          mockedApiCall.done();
        })
      })
    });

    context('with outbound dialing via an external SIP provider', () => {
      beforeEach(() => process.env.OUTBOUND_SIP_SERVER = 'sip.example.com' )
      afterEach(() => delete process.env.OUTBOUND_SIP_SERVER )

      context('with a standard number', () => {
        beforeEach(() => callee.$query().patch({phone_number: '61400000123'}))
        it('will apply SIP formatting', async () => {
          const mockedApiCall = nock('https://api.plivo.com')
            .post(/Call/, body => body.to === 'sip:61400000123@sip.example.com')
            .query(true)
            .reply(200);
          await dialer.dial(testUrl, campaign);
          mockedApiCall.done();
        })
      })
    });

    context('with a name containing non-us-ascii characters and spaces', () => {
      beforeEach(async () => {
        await Callee.query().patch({first_name: 'Tîm Jamés 23', campaign_id: campaign.id})
      });
      it('should filter the name', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.answer_url.match(/Tim-James---/))
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

      it ('should not create a QueuedCall', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => true)
          .query(true)
          .reply(404);
        await dialer.dial(testUrl, campaign)
        expect((await QueuedCall.query()).length).to.be(0);
        mockedApiCall.done()
      })
    });
  })

  context('with a predictive ratio dialer campaign', () => {
    const campaign2 = Object.assign({}, defaultCampaign, { id: 3, name: 'test campaign 2' });
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
      it('should reset the ratio to 1', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1.0);
      });
    });

    context('with the number of callers less than the campaigns predictive minimum', () => {
      beforeEach(async () => {
        await Call.query().insert({callee_id: callee.id, ended_at: moment().subtract(5, 'minutes').toDate()})
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {min_callers_for_ratio: 5});
      });
      it('should reset the ratio to 1', async () => {
        await dialer.dial(testUrl, campaign)
        const updatedCampaign = await Campaign.query().where({id: campaign.id}).first();
        expect(updatedCampaign.ratio).to.be(1.0);
      });
    });

    context('with no drops in the last 10 minutes and enough callers', () => {
      beforeEach(() => insertMinNumberOfCallers(campaign))
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
      beforeEach(() => insertMinNumberOfCallers(campaign))
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
      beforeEach(() => insertMinNumberOfCallers(campaign))
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
        const complete_call = await Call.query().insert({callee_id: completedCallee.id, status: 'complete'})
        const busy_call = await Call.query().insert({callee_id: busyCallee.id, status: 'busy'})
        await completedCallee.trigger_callable_recalculation(complete_call)
        await busyCallee.trigger_callable_recalculation(busy_call)
      })

      context('with exhaust_callees_before_recycling == false', () => {

        context('with the max_call_attempts number more than calls made', () => {
          beforeEach(async () => {
            campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: false, max_call_attempts: 2})
            const low_priority_audience = await Audience.query().insert({ campaign_id: campaign.id, priority: 5 })
            const high_priority_audience = await Audience.query().insert({ campaign_id: campaign.id, priority: 1 })
            await busyCallee.$query().patch({ audience_id: high_priority_audience.id})
            await uncalledCallee.$query().patch({ audience_id: low_priority_audience.id})
          })

          it('should call callees prioritised by their audience priority not excluding those within max_call_attempts', async () => {
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
          campaign = await campaign.$query().patchAndFetchById(campaign.id, {exhaust_callees_before_recycling: true, max_call_attempts: 2})
        })
        context('with callees with different call counts', () => {
          it('should call callees prioritised by lowest call count', async () => {
            await dialer.dial(testUrl, campaign)
            expect((await completedCallee.$query()).last_called_at).to.be(null)
            expect((await busyCallee.$query()).last_called_at).to.be(null)
            expect((await uncalledCallee.$query()).last_called_at).to.not.be(null)
          })
        })

        context('with callees with the same call count', () => {
          let pastDate
          let recentDate
          let pastCalledCallee
          let recentlyCalledCallee
          beforeEach(async () => {
            await Call.query().delete()
            await Callee.query().delete()
            pastDate = moment().subtract(6, 'hour').toDate()
            recentDate = moment().toDate()
            recentlyCalledCallee = await Callee.query().insert({id: 1, campaign_id: campaign.id, phone_number: 1, last_called_at: recentDate}).returning('*')
            pastCalledCallee   = await Callee.query().insert({id: 2, campaign_id: campaign.id, phone_number: 1, last_called_at: pastDate}).returning('*')
            const busy_call = await Call.query().insert({callee_id: recentlyCalledCallee.id, status: 'busy'})
            const no_answer_call = await Call.query().insert({callee_id: pastCalledCallee.id, status: 'no-answer'})
            await recentlyCalledCallee.trigger_callable_recalculation(busy_call)
            await pastCalledCallee.trigger_callable_recalculation(no_answer_call)
          })

          context('with dissimilar last_called_at', () => {
            it('should call callees prioritised by last_called_at', async () => {
              await dialer.dial(testUrl, campaign)
              expect(moment((await recentlyCalledCallee.$query()).last_called_at).format()).to.be(moment(recentDate).format())
              expect(moment((await pastCalledCallee.$query()).last_called_at).format()).to.not.be(moment(pastDate).format())
            })
          })

          context('with the same last_called_at', () => {
            beforeEach(async () => {
              await recentlyCalledCallee.$query().patch({last_called_at: pastDate})
            })

            it('should call callees prioritised by id', async () => {
              await dialer.dial(testUrl, campaign)
              expect(moment((await recentlyCalledCallee.$query()).last_called_at).format()).to.not.be(moment(pastDate).format())
              expect(moment((await pastCalledCallee.$query()).last_called_at).format()).to.be(moment(pastDate).format())
            })
          })
        })
      })
    })

    context('with 2 available agents and ratio of 2', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 3, max_ratio: 4, last_checked_ratio_at: new Date()
        });
        await Promise.all(_.range(2).map(() => Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id})));
        await Caller.query().insert({phone_number: '132', status: 'in-call', campaign_id: campaign.id});
      });
      beforeEach(async () => {
        await Callee.query().delete()
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
        expect((await Callee.query()).length).to.be(4)
        await dialer.dial(testUrl, campaign)
        const event = await Event.query().where({campaign_id: campaign.id, name: 'calling'}).first();
        expect(event).to.be.an(Event);
        expect(event.value).to.match(/callsToMake/);
        expect(JSON.parse(event.value).incall).to.be(1);
        expect(JSON.parse(event.value).callee_ids.length).to.be(4);
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

    context('with more queued calls than available callers', () => {
      beforeEach(async () => {
        campaign = await Campaign.query().patchAndFetchById(campaign.id, {
          ratio: 1, max_ratio: 4, last_checked_ratio_at: new Date(), calls_in_progress: 6
        });
        await Callee.query().delete();
        const inserts = _.range(8).map(() => Callee.query().insert({phone_number: '61411111111', campaign_id: campaign.id}));
        await Promise.all(inserts);
        const callees_to_mark_as_called = await Callee.query()
        for (let callee_to_mark_as_called in callees_to_mark_as_called) {
          await QueuedCall.query().insert({campaign_id: campaign.id, callee_id: callee_to_mark_as_called.id})
        }
      });

      it('should not make any calls', async () => {
        await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
        await Caller.query().insert({phone_number: '2', status: 'available', campaign_id: campaign.id});
        await dialer.dial(testUrl, campaign);
      });

      context('with log_no_calls set', () => {
        beforeEach(async () => {
          campaign = await Campaign.query().patchAndFetchById(campaign.id, {log_no_calls: true});
        })
        it('should record an event', async () => {
          await Caller.query().insert({phone_number: '1', status: 'available', campaign_id: campaign.id});
          await Caller.query().insert({phone_number: '2', status: 'in-call', campaign_id: campaign.id});
          await dialer.dial(testUrl, campaign);
          const event = await Event.query().where({campaign_id: campaign.id, name: 'no-calling'}).first();
          expect(event).to.be.an(Event);
          const {incall, calls_in_progress, callers, ratio, queued_calls} = JSON.parse(event.value)
          expect(callers).to.be(1)
          expect(incall).to.be(1)
          expect(ratio).to.be(1)
          expect(calls_in_progress).to.be(6)
          expect(queued_calls).to.be(8)
        });

      })
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

      it('should exclude queued calls made in last 15 minutes from the number of calls to make', async () => {
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
        const answered_callee = await Callee.query().where({campaign_id: campaign.id}).whereNotNull('last_called_at').first()
        await QueuedCall.query().where({callee_id: answered_callee.id}).delete()
        campaign = await dialer.decrementCallsInProgress(campaign);
        expect(campaign.calls_in_progress).to.be(2);
        // insert an old queued call that should be ignored
        await QueuedCall.query().insert({callee_id: answered_callee.id, campaign_id: campaign.id, created_at: moment().subtract(16, 'minutes').toDate()});
        expect((await QueuedCall.query().where({campaign_id: campaign.id})).length).to.be(3);
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

      it('should create an QueuedCall', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(3)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        expect((await QueuedCall.query().where({status: '200', campaign_id: campaign.id})).length).to.be(3)
        mockedApiCall.done()
      });

      it('should create an event for each call initiated', async () => {
        const mockedApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => body.to === '61411111111')
          .query(true)
          .times(3)
          .reply(200);
        await dialer.dial(testUrl, campaign)
        expect((await Event.query().where({name: 'call_initiated'})).length).to.be(3)
      });
    });
  });
});

describe('.calledEveryone with recalculateCallersRemaining called beforehand', () => {
  let campaign;
  beforeEach(async () => {
    await dropFixtures()
    campaign = await Campaign.query().insert({name: 'test'}).returning('*');
  });

  context('with no available callees on the current campaign', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', last_called_at: new Date(), campaign_id: campaign.id}));
    beforeEach(async () => {
      const anotherCampaign = await Campaign.query().insert({name: 'another'}).returning('*');
      Callee.query().insert({phone_number: '123456789', campaign_id: anotherCampaign.id});
    });
    it('should return true', async () => {
      await campaign.recalculateCallersRemaining()
      expect(await campaign.calledEveryone()).to.be(true)
    })

    context('with queued calls', () => {
      beforeEach(async() => {
        const callee = await Callee.query().insert({phone_number: '223456789', campaign_id: campaign.id, last_called_at: new Date()});
        await QueuedCall.query().insert({campaign_id: campaign.id, callee_id: callee.id})
      });
      it('should return false', async () => {
        await campaign.recalculateCallersRemaining()
        expect(await campaign.calledEveryone()).to.be(false);
      })
    })
  });
  context('with available callees', () => {
    beforeEach(async () => Callee.query().insert({phone_number: '123456789', campaign_id: campaign.id}));
    it('should return false', async () => {
      await campaign.recalculateCallersRemaining()
      expect(await campaign.calledEveryone()).to.be(false)
    })
  });

  context('with a campaign with max_call_attempts set to 1 (no recycle)', () => {
    beforeEach(async() => campaign = await Campaign.query().insert({name: 'test', max_call_attempts: 1}).returning('*'));

    context('with a callee called over 4 hours ago', () => {
      beforeEach(async() => callee = await Callee.query().insert({campaign_id: campaign.id, last_called_at: moment().subtract(5, 'hours').toDate()}));

      context('with the call busy or no-answer', () => {
        beforeEach(async () => {
          const no_answer_call = await Call.query().insert({callee_id: callee.id, status: 'no-answer'})
          await callee.trigger_callable_recalculation(no_answer_call)
        });
        it ('should be true', async() => {
          await campaign.recalculateCallersRemaining()
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
        beforeEach(async () => {
          const no_answer_call = await Call.query().insert({callee_id: callee.id, status: 'no-answer'})
          await callee.trigger_callable_recalculation(no_answer_call)
        });
        it ('should be false', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(false)
        });
      });

      context('with the call completed but dropped', () => {
        beforeEach(async () => {
          const completed_call = await Call.query().insert({callee_id: callee.id, status: 'completed', dropped: true})
          await callee.trigger_callable_recalculation(completed_call)
        })
        it ('should be false', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(false)
        });

        context('with a subsequent completed but not dropped call', () => {
          beforeEach(async () => {
            const completed_call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
            await callee.trigger_callable_recalculation(completed_call)
          });
          it ('should be true', async() => {
            await campaign.recalculateCallersRemaining()
            expect(await campaign.calledEveryone()).to.be(true)
          });
        })
      });

      context('with the completed call and "call back later" call', () => {
        beforeEach(async() => {
          await campaign.$query().patch({max_call_attempts: 3})
          const call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
          await SurveyResult.query().insert({call_id: call.id, question: 'disposition', answer: 'call back later'})
          const completed_call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
          await callee.trigger_callable_recalculation(completed_call)
        })
        it ('should be true', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(true)
        });
      });

      ['call back later', 'issue with call quality'].forEach(status => {
        context(`with the call completed and with disposition survey result of ${status}`, () => {
          beforeEach(async() => {
            const call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
            const survey_result = await SurveyResult.query().insert({call_id: call.id, question: 'disposition', answer: status})
            await callee.trigger_callable_recalculation(call, survey_result.answer)
          })
          it ('should be false', async() => {
            await campaign.recalculateCallersRemaining()
            expect(await campaign.calledEveryone()).to.be(false)
          });
        });
      })

      context('with the call completed and with disposition survey result of "answering machine"', () => {
        beforeEach(async() => {
          const call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
          const survey_result = await SurveyResult.query().insert({call_id: call.id, question: 'disposition', answer: 'answering machine'})
          await callee.trigger_callable_recalculation(call, survey_result.answer)
        })
        it ('should be true', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(true)
        });

        context('call campaigns.callback_answering_machines true', () => {
          beforeEach(async () => {
            await campaign.$query().patch({callback_answering_machines: true})
            await callee.recalculate_callable()
          })

          it ('should be false', async() => {
            await campaign.recalculateCallersRemaining()
            expect(await campaign.calledEveryone()).to.be(false)
          });
        });
      });

      context('with the call completed', () => {
        beforeEach(async () => {
          const completed_call = await Call.query().insert({callee_id: callee.id, status: 'completed'})
          await callee.recalculate_callable()
        });
        it ('should be true', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(true)
        });

        context('with a prexisting call', () => {
          beforeEach(async () => {
            const busy_call = await Call.query().insert({callee_id: callee.id, status: 'busy'})
            await callee.trigger_callable_recalculation(busy_call)
          });
          it ('should NOT reset the last_called_at', async() => {
            await campaign.recalculateCallersRemaining()
            expect(await campaign.calledEveryone()).to.be(true)
          });
        });
      });

      context('with max_call_attempts already made with status', () => {
        beforeEach(async () => {
          await Call.query().insert({callee_id: callee.id, status: 'busy'})
          const busy_call = await Call.query().insert({callee_id: callee.id, status: 'busy'})
          await callee.trigger_callable_recalculation(busy_call)
        })
        it ('should NOT reset the last_called_at', async() => {
          await campaign.recalculateCallersRemaining()
          expect(await campaign.calledEveryone()).to.be(true)
        });
      });
    });
  });
});
