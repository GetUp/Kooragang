const expect = require('expect.js');
const nock = require('nock');
const proxyquire = require('proxyquire');
const app = proxyquire('../ivr', {
  './dialer': {
    dial: async (appUrl) => {}
  }
});
const request = require('supertest-as-promised')(app);

const {
  Call,
  Callee,
  Caller,
  Log,
  SurveyResult
} = require('../models');

const caller = {
  first_name: 'bob',
  phone_number: '61288888888',
  location: 'balmain'
};
const associatedCallee = {
  first_name: 'chris',
  phone_number: '+612-7777 7777',
  location: 'rozelle',
  caller: '61288888888'
};
const unassociatedCallee = {
  first_name: 'alice',
  phone_number: '+612 9999-9999',
  location: 'drummoyne'
};

describe('/connect', () => {
  beforeEach(done => Call.query().delete().nodeify(done));
  beforeEach(done => Caller.query().delete().nodeify(done));
  beforeEach(done => Caller.query().insert(caller).nodeify(done));

  context('with an approved number', () => {
    const payload = { From: caller.phone_number };
    it('plays the briefing message', () => {
      return request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/Hi bob/);
    });
  });

  context('with an irregular, but approved, caller id', () => {
    const payload = { From: '02 8888 8888' };
    it('still identifies our caller', () => {
      request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/Hi bob/);
    });
  });

  context('with an unapproved number', () => {
    const payload = { From: '61266666666' };
    it('directs them to contact us', () => {
      return request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/only approved callers/);
    });
  });

  context('with a sip number', () => {
    const sipCaller = {
      first_name: 'alice',
      phone_number: 'alice123'
    };
    beforeEach(async () => Caller.query().insert(sipCaller));
    it('should strip out sip details for caller number', () => {
      return request.post('/connect')
        .type('form')
        .send({From: `sip:${sipCaller.phone_number}@phone.plivo.com`})
        .expect(/alice123/i);
    });
  });

  context('with a private number', () => {
    const payload = { From: 'no one we know' };
    it('directs them to contact us', () => {
      return request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/only approved callers/);
    });
  });
});

describe('/ready', () => {
  it('should put them in a conference',
    () => request.post(`/ready?caller_number=11111`).expect(/<Conference/i));

  it('should use the caller number as the conference name',
    () => request.post(`/ready?caller_number=11111`).expect(/>11111<\/Conference/i));

  context('with start=1 passed', () => {
    it('should give extra instructions',
      () => request.post(`/ready?caller_number=11111&start=1`).expect(/press star/i));
  });

  context('with * pressed', () => {
    it('should redirect them to disconnect', () => {
      return request.post(`/ready?caller_number=11111&start=1`)
        .type('form').send({Digits: '*'})
        .expect(/disconnect/i)
    });
  });
});

describe('/hold_music', () => {
  it('should return a list of mp3', () => {
    return request.post('/hold_music').expect(/welcome-pack-6.mp3/i);
  });
});

describe('/conference_event/caller', () => {
  beforeEach(async () => Caller.query().delete());
  beforeEach(async () => await Caller.query().insert(caller));

  context('with caller entering the conference', () => {
    it('should update the caller to be available and recorder the conference_member_id', async () => {
      await request.post(`/conference_event/caller?caller_number=${caller.phone_number}`)
        .type('form')
        .send({ConferenceAction: 'enter', ConferenceFirstMember: 'true', ConferenceMemberID: '11'})
      let updatedCaller = await Caller.query().first();
      expect(updatedCaller.status).to.be('available');
      expect(updatedCaller.conference_member_id).to.be('11');
    })
  });

  context('with caller exiting the conference', () => {
    it('should update the caller to be available', async () => {
      await request.post(`/conference_event/caller?caller_number=${caller.phone_number}`)
        .type('form')
        .send({ConferenceAction: 'exit', ConferenceFirstMember: 'true'})
      let updatedCaller = await Caller.query().first();
      expect(updatedCaller.status).to.be(null);
    })
  });
});

describe('/conference_event/callee', () => {
  const callee_call_uuid = '111';
  const conference_uuid = '222';
  const status = 'connected';
  const callee = associatedCallee;
  beforeEach(async () => Call.query().truncate());
  beforeEach(async () => Callee.query().delete());
  beforeEach(async () => await Callee.query().insert(callee));
  beforeEach(async () => Caller.query().delete());
  beforeEach(async () => await Caller.query().insert(caller));
  beforeEach(async () => await Call.query().insert({callee_call_uuid}));

  context('with enter event', () => {
    it('should create a Call entry', async () => {
      await request.post(`/conference_event/callee?caller_number=${caller.phone_number}`)
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

    context('with no conferences on the line', () => {
      beforeEach(async () => Caller.query().delete());
      xit('should record the delay');
      xit('should delay the call and retry and increment counter');
      context('with retry counter above max', () => {
        xit('should drop the call');
      });
      it('TODO: drop the call for now', () => {
        return request.post('/answer')
          .type('form').send({CallStatus})
          .expect(500)
      });
    });

    context('with conferences but everyone is busy with someone', () => {
      xit('should delay the call and retry and increment counter');
    });

    context('with available member', () => {
      const conference_member_id = '1111';
      const call_uuid = '2222';
      let callee;
      let mockedApiCall;
      beforeEach(async () => Call.query().truncate());
      beforeEach(async () => Caller.query().insert(caller));
      beforeEach(async () => Callee.query().insert(associatedCallee));
      beforeEach(async () => {
        callee = await Callee.query().where({phone_number: associatedCallee.phone_number}).first();
      });
      beforeEach(async () => {
        return Caller.query().where({phone_number: caller.phone_number})
          .patch({status: 'available', conference_member_id})
      });
      beforeEach(() => {
        mockedApiCall = nock('https://api.plivo.com')
          .post(/\/Conference\/61288888888\/Member\/1111\/Speak/, (body) => {
             return body.text === 'Bridger';
          })
          .query(true)
          .reply(200);
      });

      it('should add the caller to the conference', () => {
        return request.post(`/answer?name=Bridger&callee_id=${callee.id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
          .expect(/61288888888<\/Conference/)
      });

      it('should speak the callee\'s name in the conference', () => {
        return request.post(`/answer?name=Bridger&callee_id=${callee.id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
          .then(() => mockedApiCall.done() );
      });

      it('should create a call record', () => {
        return request.post(`/answer?name=Bridger&callee_id=${callee.id}`)
          .type('form').send({CallStatus, CallUUID: call_uuid})
          .then(async () => {
            const call = await Call.query().where({callee_id: callee.id, callee_call_uuid: call_uuid}).first();
            expect(call).to.be.an(Call);
          });
      });
    });
  });
});

describe('/hangup', () => {
  const CallUUID = '111';

  context('with a hangup before answered', () => {
    const CallStatus = 'no-answer';
    let callee;
    beforeEach(async () => Call.query().truncate());
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
  });

  context('with an existing call', () => {
    const CallStatus = 'completed';
    beforeEach(async () => Call.query().truncate());
    beforeEach(async () => Call.query().insert({callee_call_uuid: CallUUID, status: 'answered'}));

    it('should record the call has ended with the status and duration', async () => {
      return request.post(`/hangup?name=Bridger&callee_id=111`)
        .type('form').send({CallStatus: 'completed', CallUUID, Duration: '10'})
        .then(async () => {
          const call = await Call.query()
            .where({status: 'completed', callee_call_uuid: CallUUID, duration: 10})
            .first();
          expect(call).to.be.an(Call);
        });
    });
  });
});
