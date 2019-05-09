const expect = require('expect.js');
const nock = require('nock');
const proxyquire = require('proxyquire');
const moment = require('moment');
const voice = require('../../ivr/voice');
const ivrCallee = proxyquire('../../ivr/callee', {
  '../dialer': {
    dial: async (appUrl) => {}
  }
});
const app = require('../../ivr/common');
app.use(ivrCallee);
const request = require('supertest')(app);

const {dropFixtures} = require('../test_helper')
const {
  QueuedCall,
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  Redirect,
  SurveyResult
} = require('../../models');

const questions = require('../../seeds/questions.example.json');
const more_info = require('../../seeds/more_info.example.json');
const defaultCampaign = {
  id: 1,
  name: 'test',
  questions: questions,
  more_info: more_info,
  phone_number: '1111',
  sms_number: '22222222'
}
const activeCampaign = Object.assign({status: 'active'}, defaultCampaign)
const pausedCampaign = Object.assign({status: 'paused'}, defaultCampaign)
const inactiveCampaign = Object.assign({status: 'inactive'}, defaultCampaign)
const statuslessCampaign = Object.assign({status: null}, defaultCampaign)
const CallUUID = '111';
let campaign
const callerTemplate = {
  first_name: 'bob',
  phone_number: '61288888888',
  location: 'balmain',
  campaign_id: 1
};
const associatedCallee = {
  first_name: 'chris',
  phone_number: '61277777777',
  location: 'rozelle',
  caller: '61288888888',
  campaign_id: 1
};
const unassociatedCallee = {
  first_name: 'alice',
  phone_number: '+612 9999-9999',
  location: 'drummoyne',
  campaign_id: 1
};

beforeEach(async () => {
  await dropFixtures()
});
beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));

describe('/answer', () => {
  context('with a called picked up', () => {
    const CallStatus = 'in-progress';
    const conference_member_id = '1111';
    const call_uuid = '2222';
    let callee, caller, queued_call;
    let mockedApiCall;
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => Caller.query().delete());
    beforeEach(async () => Callee.query().insert(associatedCallee));
    beforeEach(async () => {
      callee = await Callee.query().where({phone_number: associatedCallee.phone_number}).first();
      caller = await Caller.query().insert(callerTemplate);
      queued_call  = await QueuedCall.query().insert({callee_id: callee.id, campaign_id: callee.campaign_id});
      campaign = await campaign.$query().patch({calls_in_progress: 1}).returning('*').first()
    });

    context('with no callers available', () => {
      beforeEach(async () => Caller.query().delete());

      it('returns hangup but drops the call', () => {
        return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
          .expect(/hangup/i)
          .expect(/drop/);
      });

      it('should record the drop on the call and as an event', () => {
        return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
          .then(async () => {
            const call = await Call.query().where({callee_id: callee.id, callee_call_uuid: call_uuid, dropped: true}).first();
            expect(call).to.be.a(Call);
            const event = await Event.query().where({call_id: call.id, name: 'drop'}).first();
            expect(event).to.be.an(Event);
          });
      });

      it('should decrement calls_in_progress', async () => {
        await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
        campaign = await campaign.$query()
        expect(campaign.calls_in_progress).to.be(0)
      });

      it('should remove the QueuedCall for the callee', async () => {
        await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
        expect((await QueuedCall.query()).length).to.be(0)
      });
    });

    context('with available caller', () => {
      beforeEach(async () => {
        return Caller.query().where({phone_number: caller.phone_number})
          .patch({status: 'available', conference_member_id})
      });

      context('but the caller is from another campaign', () => {
        beforeEach(async () => {
          const anotherCampaign = await Campaign.query().insert({name: 'another'});
          return caller.$query().patch({campaign_id: anotherCampaign.id});
        });
        it('returns hangup and drops the call', () => {
          return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .expect(/hangup/i)
            .expect(/drop/);
        });
      });

      it('should remove the QueuedCall for the callee', async () => {
        await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
        expect((await QueuedCall.query()).length).to.be(0)
      });

      context('with the speak api mocked', () => {
        beforeEach(() => {
          mockedApiCall = nock('https://api.plivo.com')
            .post(`/v1/Account/test/Conference/conference-${caller.id}/Member/1111/Speak/`, (body) => {
               return body.text === 'Bridger' &&
                body.language === voice().language &&
                body.voice === voice().voice &&
                body.callback_url.match(/log/);
            })
            .query(true)
            .reply(200);
        });

        it('should also decrement calls_in_progress', async () => {
          await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
          campaign = await campaign.$query()
          expect(campaign.calls_in_progress).to.be(0)
        });

        it('should set their status to in-call and update the seconds_waiting', async () => {
          await caller.$query().patch({updated_at: moment().subtract(1, 'seconds').toDate(), seconds_waiting: 4 });
          await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
          caller = await caller.$query()
          expect(caller.status).to.be('in-call')
          expect(caller.seconds_waiting).to.be(5)
        });

        it('should add the caller to the conference', () => {
          return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .expect(new RegExp(caller.id))
        });

        it('should speak the callee\'s name in the conference', async () => {
          process.env.SPEAK_NAMES = 'true'
          await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .then(() => mockedApiCall.done() );
          delete process.env.SPEAK_NAMES
        });

        it('should create a call record', () => {
          return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .then(async () => {
              const call = await Call.query().where({callee_id: callee.id, callee_call_uuid: call_uuid}).first();
              expect(call).to.be.an(Call);
            });
        });
      });
      context('with the speak api mocked to fail', () => {
        beforeEach(() => {
          mockedApiCall = nock('https://api.plivo.com')
            .post(`/v1/Account/test/Conference/conference-${caller.id}/Member/1111/Speak/`, (body) => {
               return body.text === 'Bridger';
            })
            .query(true)
            .reply(500, 'fake error');
        });

        it('should record an event if speak names fails', async () => {
          process.env.SPEAK_NAMES = 'true'
          await request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .then(() => mockedApiCall.done() );
          delete process.env.SPEAK_NAMES
          const event = await Event.query().where({campaign_id: 1, name: 'failed_speak_name'}).first()
          expect(event.value).to.match(/500/)
        });
      });

      context('when the callee has no name set', () => {
        it('should not say anything', () => {
          return request.post(`/answer?callee_id=${callee.id}&name=&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
        });
      });
    });
  });
});

describe('/conference_event/callee', () => {
  const callee_call_uuid = '111';
  const conference_uuid = '222';
  const status = 'connected';
  const callee = associatedCallee;
  beforeEach(async () => Event.query().delete());
  beforeEach(async () => Call.query().delete());
  beforeEach(async () => Callee.query().delete());
  beforeEach(async () => Callee.query().insert(callee));
  beforeEach(async () => Caller.query().delete());
  beforeEach(async () => Caller.query().insert(callerTemplate));
  beforeEach(async () => Call.query().insert({callee_call_uuid}));

  context('with enter event', () => {
    it('should create a Call entry', async () => {
      await request.post('/conference_event/callee')
        .type('form')
        .send({
          ConferenceAction: 'enter',
          To: callee.phone_number,
          CallUUID: callee_call_uuid,
          ConferenceUUID: conference_uuid
        });
      const call = await Call.query().where({
        status,
        callee_call_uuid,
        conference_uuid
      }).first();
      expect(call).to.be.an(Call);
    })

    it('should not overwrite a Call machine_detection status', async () => {
      beforeEach(async () => Call.query().delete());
      const call = await Call.query().insert({callee_call_uuid, status: "machine_detection"})
      await request.post('/conference_event/callee')
        .type('form')
        .send({
          ConferenceAction: 'enter',
          To: callee.phone_number,
          CallUUID: callee_call_uuid,
          ConferenceUUID: conference_uuid
        });
      expect(call.status).to.be('machine_detection');
    })
  });
});

describe('/hangup', () => {
  context('with a hangup before answered', () => {
    const CallStatus = 'no-answer';
    let callee;
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => Callee.query().delete());
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee);
      await QueuedCall.query().insert({callee_id: callee.id, campaign_id: callee.campaign_id});
    });

    it('should remove the QueuedCall for the callee', async () => {
      await request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus, CallUUID, Duration: '10'})
      expect((await QueuedCall.query()).length).to.be(0)
    });

    it('should record the call was hungup with the status, duration, bill duration and total cost of the call', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus, CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
        .then(async () => {
          const call = await Call.query()
            .where({status: CallStatus, callee_call_uuid: CallUUID, duration: 10, bill_duration: 30, total_cost: 0.0102})
            .first();
          expect(call).to.be.an(Call);
        });
    });

    it('should trigger a recalculation of call fields', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus, CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
        .then(async () => {
          const call = await Call.query()
            .eager('callee')
            .where({status: CallStatus, callee_call_uuid: CallUUID, duration: 10, bill_duration: 30, total_cost: 0.0102})
            .first();
          expect(call.callee.callable_recalculated_at).to.not.be(null)
        });
    });

    context('with answering machine detection', () => {
      it('should record the call was hungup with the status, duration, bill duration and total cost of the call', async () => {
        return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
          .type('form').send({CallStatus, CallUUID, Duration: '10', Machine: 'true', BillDuration: '30', TotalCost: '0.01020'})
          .then(async () => {
            const call = await Call.query()
              .where({status: 'machine_detection', callee_call_uuid: CallUUID, duration: 10, bill_duration: 30, total_cost: 0.0102})
              .first();
            expect(call).to.be.an(Call);
          });
      });
    })
  });

  context('with an existing call that has not yet connected and a caller with status in-call', () => {
    let callee, caller, call
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => Caller.query().delete());
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee);
      caller = await Caller.query().insert(Object.assign( { status: 'in-call' } , callerTemplate))
      call = await Call.query().insert({callee_call_uuid: CallUUID, status: 'answered', callee_id: callee.id, caller_id: caller.id})
    })

    it('should record an event', async () => {
      await request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
      const event = await Event.query().where({name: 'exit_before_conference'}).first()
      expect(event.call_id).to.be(call.id.toString())
      expect(event.caller_id).to.be(caller.id)
    })

    it('should update the caller to be available', async () => {
      await request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
      const updatedCaller = await Caller.query().first()
      expect(updatedCaller.status).to.be('available')
    })

    it('should record the call has ended with the status, duration, bill duration and total cost of the call', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
        .expect(200)
        .then(async () => {
          const call = await Call.query()
            .where({status: 'completed', callee_call_uuid: CallUUID, duration: 10, bill_duration: 30, total_cost: 0.0102})
            .first();
          expect(call).to.be.an(Call);
        });
    });
  });

  context('with an existing call', () => {
    const CallStatus = 'completed';
    let callee;
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee);
      Call.query().insert({callee_call_uuid: CallUUID, status: 'answered', callee_id: callee.id})
    })

    it('should record the call has ended with the status, duration, bill duration and total cost of the call', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10', BillDuration: '30', TotalCost: '0.01020'})
        .expect(200)
        .then(async () => {
          const call = await Call.query()
            .where({status: 'completed', callee_call_uuid: CallUUID, duration: 10, bill_duration: 30, total_cost: 0.0102})
            .first();
          expect(call).to.be.an(Call);
        });
    });
  });
});

describe('/callee_fallback', () => {
  it('stores a callee fallback event', async () => {
    await request.post('/callee_fallback?callee_id=357&campaign_id=1')
      .type('form').send({CallUUID})
      .expect(/Hangup/)
    const event = await Event.query().where({campaign_id: 1, name: 'callee fallback'}).first()
    expect(event.value).to.match(new RegExp(CallUUID))
    expect(event.value).to.match(/357/)
  });
});
