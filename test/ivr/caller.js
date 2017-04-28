const expect = require('expect.js');
const nock = require('nock');
const proxyquire = require('proxyquire');
const moment = require('moment');
const ivrCaller = proxyquire('../../ivr/caller', {
  '../dialer': {
    dial: async (appUrl) => {},
    calledEveryone: async (appUrl) => false,
  }
});
const app = require('../../ivr/common');
app.use(ivrCaller);
const request = require('supertest')(app);

const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  SurveyResult
} = require('../../models');

const questions = require('../../seeds/questions.example.json');
const malformedQuestion = {
  "disposition": {
    "name": "test–—‘’‚“”„†‡‰‹›€ing",
    "answers": {
      "2": {
        "value": "answering¡¢£©®¶ & machine"
      }
    }
  }
};
const more_info = require('../../seeds/more_info.example.json');
const defaultCampaign = {
  id: 1,
  name: 'test',
  questions: questions,
  more_info: more_info,
  phone_number: '1111',
  sms_number: '22222222'
}
const malformedCampaign = {
  id: 1,
  name: 'test',
  questions: malformedQuestion,
  more_info: more_info,
  phone_number: '1111',
  sms_number: '22222222'
}
const activeCampaign = Object.assign({status: 'active'}, defaultCampaign)
const pausedCampaign = Object.assign({status: 'paused'}, defaultCampaign)
const inactiveCampaign = Object.assign({status: 'inactive'}, defaultCampaign)
const statuslessCampaign = Object.assign({status: null}, defaultCampaign)
const amdCampaign = Object.assign({status: 'active', detect_answering_machine: true}, defaultCampaign)
const operationalWindowCampaign = Object.assign({daily_start_operation: '00:00:00', daily_stop_operation: '00:00:00'}, activeCampaign)

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

  context('with a inactive campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(inactiveCampaign));
    const payload = { From: caller.phone_number };
    it('plays the outside operational window briefing message', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/has been completed/);
    });
  });

  context('with an operational window campaign', () => {
    beforeEach(async () => { await Campaign.query().delete() });
    beforeEach(async () => campaign = await Campaign.query().insert(operationalWindowCampaign));
    const payload = { From: caller.phone_number };
    it('plays the operational window briefing message', () => {
      return request.post(`/connect?campaign_id=${campaign.id}&number=${caller.phone_number}`)
        .type('form')
        .send(payload)
        .expect(/times of operation/);
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

  context('with 0 pressed', () => {
    it('should redirect them to disconnect', () => {
      return request.post(`/ready?caller_id=${caller.id}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '0'})
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
    it('should send an sms to their number with the script_url', async() => {
      await campaign.$query().patch({script_url: 'http://test.com/script'});
      await request.post(`/ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`)
        .type('form').send({Digits: '3'})
        .expect(/message/i)
        .expect(/test.com/i)
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

describe('/survey', () => {
  const conference_uuid = '222';
  beforeEach(async () => {
    await Call.query().delete();
    await Campaign.query().delete();
    await SurveyResult.query().delete();
  });
  beforeEach(async () => call = await Call.query().insert({callee_call_uuid: CallUUID, conference_uuid, status: 'answered'}));

  context('after the first question', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));
    it ('should return the question specified by the q param', () => {
      const question = 'action';
      return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}`)
        .expect(new RegExp(`q=${question}`))
        .expect(new RegExp(`${question}`, 'i'));
    });
  });

  context('with invalid xml characters', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(malformedCampaign));
    it('should be spripped out to valid xml', async () => {
      const question = 'disposition';
      return request.post(`/survey?q=${question}&call_id=${call.id}&campaign_id=${campaign.id}`)
        .expect(new RegExp('testing', 'i'));
    });
  });

  context('without a call record (* pressed while in the queue)', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));
    beforeEach(async () => await Call.query().delete())
    it('prompts to re-enter the queue', () => {
      return request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/have left the call queue/)
        .expect(/call_again\?caller_id=1/)
    });

    it('records an event', async() => {
      await request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .type('form')
        .send({CallUUID})
        .expect(200);
      const event = await Event.query().where({campaign_id: campaign.id, name: 'left queue without call'}).first()
      expect(event.value).to.be(`{"CallUUID":"${CallUUID}"}`)
      expect(event.caller_id).to.be(1)
    })
  })

  context('without a call record (* pressed while in the queue)', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));
    beforeEach(async () => await Call.query().delete())
    it('prompts to re-enter the queue', () => {
      return request.post(`/survey?q=disposition&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/have left the call queue/)
        .expect(/call_again\?caller_id=1/)
    })
  })

  context('with a call that has status of machine_detection', () => {
    beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));
    beforeEach(async () => call = await Call.query().patchAndFetchById(call.id, {status: 'machine_detection'}))
    it('re-enters the queue', () => {
      return request.post(`/survey?q=disposition&call_id=${call.id}&caller_id=1&campaign_id=${campaign.id}`)
        .expect(/Answering machine detected/)
        .expect(/ready\?caller_id=1/)
    })
  })
});

describe('/survey_result', () => {
  beforeEach(async () => await SurveyResult.query().delete());
  const payload = { Digits: '2', To: '614000100'};
  it('stores the result', () => {
    return request.post('/survey_result?q=disposition&campaign_id=1')
      .type('form').send(payload)
      .then(async () => {
        const result = await SurveyResult.query()
          .where({question: 'disposition'})
          .first();
        expect(result.answer).to.be('answering machine');
      });
  });

  context('with a non-meaningful disposition', () => {
    const payload = { Digits: '2', To: '614000100'};
    it ('should announce the result & redirect to call_again', () => {
      return request.post('/survey_result?q=disposition&campaign_id=1')
        .type('form').send(payload)
        .expect(/answering machine/)
        .expect(/call_again/);
    });
  });

  context('with a meaningful disposition', () => {
    const payload = { Digits: '4', To: '614000100'};
    it ('should announce the result & redirect to the next question', () => {
      return request.post('/survey_result?q=disposition&campaign_id=1')
        .type('form').send(payload)
        .expect(/meaningful/)
        .expect(/survey\?q=/);
    });
  });

  context('with invalid xml characters', () => {
    beforeEach(async () => {
      await Campaign.query().delete();
      campaign = await Campaign.query().insert(malformedCampaign)
    });
    const payload = { Digits: '2', To: '614000100'};
    it('should be spripped out to valid xml', async () => {
      const question = 'disposition';
      return request.post(`/survey_result?q=disposition&campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(new RegExp('answering &amp; machine', 'i'));
    });
  });

  context('with a callee that wants more info', () => {
    const payload = { Digits: '2', To: '614000100'};
    let callee, call;
    beforeEach(async () => {
      callee = await Callee.query().insert(associatedCallee);
      call = await Call.query().insert({callee_id: callee.id});
    });
    it ('should receive an sms', () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(/call/i);
    });
    it ('should receive an sms from the number set on the campaign', () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(new RegExp(campaign.sms_number));
    });
    it ("should send the sms to the callee's number", () => {
      return request.post(`/survey_result?q=action&campaign_id=1&call_id=${call.id}`)
        .type('form').send(payload)
        .expect(new RegExp(callee.phone_number.replace(/[^0-9]/g, '')));
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

describe('/machine_detection', () => {
  const callee_call_uuid = '111';
  const conference_uuid = '222';
  const payload = { CallUUID: callee_call_uuid };
  let call, campaign;

  beforeEach(async () => {
    await Campaign.query().delete()
    await Call.query().delete()
    await Caller.query().delete()
    campaign = await Campaign.query().insert(amdCampaign)
    call = await Call.query().insert({callee_call_uuid, conference_uuid})
  });

  context('with an existing call', () => {
    it('hangs up on the callee', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .delete(/\/Call\/111\//)
        .reply(200);
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200);
      mockedApiCall.done();
    });

    it('patches call status to machine_detection', async () => {
      const mockedApiCall = nock('https://api.plivo.com')
        .delete(/\/Call\/111\//)
        .reply(200);
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send(payload)
        .expect(200);
      const updatedCall = await Call.query().where({id: call.id}).first();
      expect(updatedCall.status).to.be('machine_detection');
    });
  });

  context('without an existing call', () => {
    it('create error event', async () => {
      await request.post(`/machine_detection?campaign_id=${campaign.id}`)
        .type('form').send();
      const event = await Event.query().where({name: 'failed_post_machine_callee_transfer', campaign_id: campaign.id}).first();
      expect(event).to.be.an(Event);
    });
  });
});
