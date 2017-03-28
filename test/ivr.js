const expect = require('expect.js');
const nock = require('nock');
const proxyquire = require('proxyquire');
const moment = require('moment');
const app = proxyquire('../ivr', {
  './dialer': {
    dial: async (appUrl) => {},
    isComplete: async (appUrl) => false,
  }
});
const request = require('supertest-as-promised')(app);

const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  Log,
  SurveyResult
} = require('../models');

const questions = require('../seeds/questions.example.json');
const more_info = require('../seeds/more_info.example.json');
const defaultCampaign = {
  id: 1,
  name: 'test',
  questions: questions,
  more_info: more_info,
  phone_number: '1111'
}
const activeCampaign = Object.assign({status: 'active'}, defaultCampaign, {})
const pausedCampaign = Object.assign({status: 'paused'}, defaultCampaign, {})
const inactiveCampaign = Object.assign({status: 'inactive'}, defaultCampaign, {})
const statuslessCampaign = Object.assign({status: null}, defaultCampaign, {})
const CallUUID = '111';
let campaign
let caller = {
  first_name: 'bob',
  phone_number: '61288888888',
  location: 'balmain',
  campaign_id: 1
};
const associatedCallee = {
  first_name: 'chris',
  phone_number: '+612-7777 7777',
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
  await Event.query().delete();
  await Call.query().delete();
  await Callee.query().delete();
  await Caller.query().delete();
  await Campaign.query().delete();
});
beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));

describe('/connect', () => {
  context('with no campaign id specified', () => {
    const payload = { From: caller.phone_number };
    it('plays the briefing message', () => {
      return request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/error/);
    });
  });

  context('with a sip number', () => {
    it('should strip out sip details for caller number', async () => {
      await request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send({From: 'sip:alice123@phone.plivo.com'})
        .expect(/caller_number=alice123&amp;start=1/);
    });
  });

  context('with a private number', () => {
    const payload = { From: '' };
    it('directs them to enable caller id', () => {
      return request.post(`/connect?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/caller id/);
    });
  });

  context('with a callback', () => {
    const payload = { From: '33333' };
    it('should use the number passed in the number parameter', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/Welcome back/)
        .expect(new RegExp(caller.phone_number));
    });
  });

  context('with a paused campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(pausedCampaign));
    const payload = { From: caller.phone_number };
    it('plays the paused briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/currently paused/);
    });
  });

  context('with a statusless campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(statuslessCampaign));
    const payload = { From: caller.phone_number };
    it('plays the paused briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/currently paused/);
    });
  });

  context('with a statusless campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign));
    const payload = { From: caller.phone_number };
    it('plays the paused briefing message ', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/has been completed/);
    });
  });
});

describe('/ready', () => {
  context('with an starting path', () => {
    let startPath;
    beforeEach(() => startPath = `/ready?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1`);

    context('with an unknown number', () => {
      const payload = { CallUUID: '1231' };
      it('create a record', async() => {
        await request.post(startPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i);
        const foundCaller = await Caller.query().where({phone_number: caller.phone_number}).first();
        expect(foundCaller).to.be.a(Caller);
      });
    });

    context('with an existing number', () => {
      let payload;
      beforeEach(() => payload = {From: caller.phone_number, CallUUID: '1'});
      beforeEach(async () => caller = await Caller.query().insert(caller));

      it('create a new record', async() => {
        await request.post(startPath)
          .type('form')
          .send({From: caller.phone_number})
          .expect(/call queue/i);
        const callers = await Caller.query().where({phone_number: caller.phone_number});
        expect(callers.length).to.be(2);
      });

      it('record the call uuid', async() => {
        await request.post(startPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i);
        expect(await Caller.query().where({call_uuid: payload.CallUUID}).first()).to.be.a(Caller);
      });
    });

    it('should give extra instructions',
      () => request.post(`/ready?caller_id=${caller.id}&start=1&campaign_id=${campaign.id}`).expect(/press star/i));
  });

  it('should put them in a conference',
    () => request.post(`/ready?caller_id=${caller.id}&campaign_id=${campaign.id}`).expect(/<Conference/i));

  it('should use the caller number as the conference name',
    () => request.post(`/ready?caller_id=${caller.id}&campaign_id=${campaign.id}`).expect(new RegExp(caller.id)));

  context('with * pressed', () => {
    it('should redirect them to disconnect', () => {
      return request.post(`/ready?caller_id=${caller.id}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '*'})
        .expect(/disconnect/i)
    });
  });

  context('with 2 pressed', () => {
    it('should set a boolean for a call back', async () => {
      await request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '2', CallUUID: '1234'})
        .expect(/hang up now/i)
      const updatedCaller = await Caller.query().where({call_uuid: '1234'}).first();
      return expect(updatedCaller.callback).to.be(true);
    });
  });

  context('with 3 pressed', () => {
    it('should send an sms to their number', () => {
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '3'})
        .expect(/message/i)
    });
  });

  context('with 4 pressed', () => {
    it('should give the caller information on the dialing tool', async () => {
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '4'})
        .expect(/system works/i)
    });
  });

  context('with more info key pressed', () => {
    it('should give the caller information on the campaign', async () => {
      const more_info_item_key = Object.keys(campaign.more_info)[0];
      const more_info_item_content = campaign.more_info[more_info_item_key];
      const regexp = new RegExp(more_info_item_content, "i");
      return request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: more_info_item_key})
        .expect(regexp)
    });
  });
});

describe('/call_ended', () => {
  context('with no matching caller', () => {
    it('should record an event', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
        .expect(200)
      expect(await Event.query().where({name: 'caller ended without entering queue'}).first()).to.be.a(Event);
    });
  });

  context('with callback not set to true', () => {
    beforeEach(async () => caller = await Caller.query().insert({callback: null, call_uuid: CallUUID, campaign_id: campaign.id}));
    it('should not call them back', () => {
      return request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
    });
  });

  context('with callback set to true', () => {
    let caller;
    beforeEach(async () => caller = await Caller.query().insert({callback: true, call_uuid: CallUUID, campaign_id: campaign.id, phone_number: '1234'}));
    it('should call them back', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .post(/Call/, body => {
          return body.to === caller.phone_number && body.from === campaign.phone_number
            && body.answer_url.match(/connect/)
            && body.answer_url.match(/callback=1/)
            && body.answer_url.match(/campaign_id=1/);
        })
        .query(true)
        .reply(200);
      return request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
        .then(() => mockedApiCall.done());
    });
  });

  context('with a caller with status "in-call"', () => {
    beforeEach(async () => caller = await Caller.query().insert({status: 'in-call', call_uuid: CallUUID, campaign_id: campaign.id}));
    it('should unset the "in-call" status', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
      expect((await caller.$query()).status).to.be('complete');
    });

    it('should create a caller_complete event', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
      expect(await Event.query().where({name: 'caller_complete'}).first()).to.be.a(Event);
    });
  })

  context('with a caller with status "available"', () => {
    beforeEach(async () => caller = await Caller.query().insert({status: 'available', call_uuid: CallUUID, updated_at: moment().subtract(1, 'seconds').toDate(), seconds_waiting: 4, campaign_id: campaign.id}));
    it('should update their seconds_waiting', async () => {
      await request.post(`/call_ended?campaign_id=${campaign.id}`)
        .type('form').send({CallUUID})
      caller = await caller.$query()
      expect(caller.seconds_waiting).to.be(5);
      expect(caller.status).to.be('complete');
    });
  });
});

describe('/hold_music', () => {
  it('should return a list of mp3', () => {
    return request.post('/hold_music').expect(/welcome-pack-6.mp3/i);
  });
});

describe('/conference_event/caller', () => {
  beforeEach( async () => {
    await Event.query().delete();
    await Call.query().delete();
    await Callee.query().delete();
    await Caller.query().delete();
    await Campaign.query().delete();
  });
  beforeEach(async () => {
    campaign = await Campaign.query().insert({id: 1, name: 'test', status: 'active'});
    await Caller.query().insert(caller);
  });

  context('with caller entering the conference', () => {
    it('should update the caller to be available and recorder the conference_member_id', async () => {
      await request.post(`/conference_event/caller?caller_id=${caller.id}&campaign_id=${campaign.id}`)
        .type('form')
        .send({ConferenceAction: 'enter', ConferenceFirstMember: 'true', ConferenceMemberID: '11'})
      let updatedCaller = await Caller.query().first();
      expect(updatedCaller.status).to.be('available');
      expect(updatedCaller.conference_member_id).to.be('11');
    })
  });

  context('with 2 pressed during the conference', () => {
    const CallUUID = '1';
    const ConferenceUUID = '2';

    it('should make a transfer api call', async () => {
      const call = await Call.query().insert({conference_uuid: ConferenceUUID});
      const mockedApiCall = nock('https://api.plivo.com')
        .post(/\/Call\/1\//, (body) => {
           return body.aleg_url.match(/survey_result/)
              && body.aleg_url.match(/digit=2/);
        })
        .query(true)
        .reply(200);
      await request.post(`/conference_event/caller?caller_id=${caller.id}`)
        .type('form')
        .send({ConferenceAction: 'digits', ConferenceDigitsMatch: '2', CallUUID, ConferenceUUID})
        .expect(200);
      mockedApiCall.done();
    })
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
  beforeEach(async () => await Callee.query().insert(callee));
  beforeEach(async () => Caller.query().delete());
  beforeEach(async () => await Caller.query().insert(caller));
  beforeEach(async () => await Call.query().insert({callee_call_uuid}));

  context('with enter event', () => {
    it('should create a Call entry', async () => {
      await request.post('/conference_event/callee')
        .type('form')
        .send({
          ConferenceAction: 'enter', To: callee.phone_number,
          CallUUID: callee_call_uuid, ConferenceUUID: conference_uuid
        });
      const call = await Call.query().where({
        status,
        callee_call_uuid, conference_uuid
      }).first();
      expect(call).to.be.an(Call);
    })
  });
});

describe('/answer', () => {
  context('with a called picked up', () => {
    const CallStatus = 'in-progress';
    const conference_member_id = '1111';
    const call_uuid = '2222';
    let callee;
    let mockedApiCall;
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => Caller.query().delete());
    beforeEach(async () => Callee.query().insert(associatedCallee));
    beforeEach(async () => {
      callee = await Callee.query().where({phone_number: associatedCallee.phone_number}).first();
      campaign = await campaign.$query().patch({calls_in_progress: 1}).returning('*').first()
      await Caller.query().insert(caller);
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
    });

    context('with available caller', () => {
      beforeEach(async () => {
        return Caller.query().where({phone_number: caller.phone_number})
          .patch({status: 'available', conference_member_id})
      });

      context('but the caller is from another campaign', () => {
        beforeEach(async() => {
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

      context('with the speak api mocked', () => {
        beforeEach(() => {
          mockedApiCall = nock('https://api.plivo.com')
            .post(`/v1/Account/test/Conference/conference-${caller.id}/Member/1111/Speak/`, (body) => {
               return body.text === 'Bridger';
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

        it('should speak the callee\'s name in the conference', () => {
          return request.post(`/answer?name=Bridger&callee_id=${callee.id}&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
            .then(() => mockedApiCall.done() );
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

      context('when the callee has no name set', () => {
        it('should not say anything', () => {
          return request.post(`/answer?callee_id=${callee.id}&name=&campaign_id=${campaign.id}`)
            .type('form').send({CallStatus, CallUUID: call_uuid})
        });
      });
    });
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
    });

    it('should record the call was hungup with the status and duration', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
        .type('form').send({CallStatus, CallUUID, Duration: '10'})
        .then(async () => {
          const call = await Call.query()
            .where({status: CallStatus, callee_call_uuid: CallUUID, duration: 10})
            .first();
          expect(call).to.be.an(Call);
        });
    });

    context('with answering machine detection', () => {
      it('should record the call was hungup with the status and duration', async () => {
        return request.post(`/hangup?name=Bridger&callee_id=${callee.id}`)
          .type('form').send({CallStatus, CallUUID, Duration: '10', Machine: 'true'})
          .then(async () => {
            const call = await Call.query()
              .where({status: 'machine_detected', callee_call_uuid: CallUUID, duration: 10})
              .first();
            expect(call).to.be.an(Call);
          });
      });
    })
  });

  context('with an existing call', () => {
    const CallStatus = 'completed';
    beforeEach(async () => Event.query().delete());
    beforeEach(async () => Call.query().delete());
    beforeEach(async () => Call.query().insert({callee_call_uuid: CallUUID, status: 'answered'}));

    it('should record the call has ended with the status and duration', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=111`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10'})
        .expect(200)
        .then(async () => {
          const call = await Call.query()
            .where({status: 'completed', callee_call_uuid: CallUUID, duration: 10})
            .first();
          expect(call).to.be.an(Call);
        });
    });
  });
});

describe('with campaign id in path', () => {
  beforeEach(async () => {
    await Event.query().delete();
    await Call.query().delete();
    await Callee.query().delete();
    await Campaign.query().delete();
    await Caller.query().delete();
  });
  beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));

  it ('should return a page with the campaign name', () => {
    return request.get(`/${campaign.id}`)
      .expect(/test/);
  });
});

describe('/survey', () => {
  const conference_uuid = '222';
  beforeEach(async () => {
    await Call.query().delete();
    await Campaign.query().delete();
    await SurveyResult.query().delete();
  });
  beforeEach(async () => call = await Call.query().insert({callee_call_uuid: CallUUID, conference_uuid, status: 'answered'}));
  beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));

  it ('should return the question specified by the q param', () => {
    const question = 'action';
    return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}`)
      .expect(new RegExp(`q=${question}`))
      .expect(new RegExp(`Enter the ${question} code`, 'i'));
  });
});

describe('/survey_result', () => {
  beforeEach(async () => await SurveyResult.query().delete());

  it('stores the result', () => {
    return request.post('/survey_result?q=disposition&campaign_id=1')
      .type('form').send({ Digits: '2' })
      .then(async () => {
        const result = await SurveyResult.query()
          .where({question: 'disposition'})
          .first();
        expect(result.answer).to.be('answering machine');
      });
  });

  context('with a non-meaningful disposition', () => {
    const payload = { Digits: '2' };
    it ('should announce the result & redirect to call_again', () => {
      return request.post('/survey_result?q=disposition&campaign_id=1')
        .type('form').send(payload)
        .expect(/answering machine/)
        .expect(/call_again/);
    });
  });

  context('with a meaningful disposition', () => {
    const payload = { Digits: '7' };
    it ('should announce the result & redirect to the next question', () => {
      return request.post('/survey_result?q=disposition&campaign_id=1')
        .type('form').send(payload)
        .expect(/meaningful/)
        .expect(/survey\?q=/);
    });
  });
});

describe('/fallback', () => {
  it('stores a caller fallback event', async () => {
    await request.post('/fallback?campaign_id=1')
      .type('form').send({CallUUID})
      .expect(/call back/)
    const event = await Event.query().where({campaign_id: 1, name: 'caller fallback'}).first()
    expect(event.value).to.be(`{"CallUUID":"${CallUUID}"}`)
  });
});

describe('/call_again', () => {
  context('with a paused campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(pausedCampaign));
    const payload = { Digits: '2' };
    it ('should announce the result, notify user that campaign is currently paused', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(/currently paused/);
    });
  });
  context('with a statusless campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(statuslessCampaign));
    it ('should announce the result, notify user that campaign is currently paused', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send()
        .expect(/currently paused/);
    });
  });

  context('with an inactive campaign', async () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign));
     it ('should announce the result, notify user that campaign is currently completed', () => {
      return request.post(`/call_again?campaign_id=${campaign.id}`)
        .type('form').send()
        .expect(/has been completed/);
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
