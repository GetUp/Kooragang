const app = require('../dialer');
const request = require('supertest')(app);
const expect = require('expect.js');
const timekeeper = require('timekeeper');
const moment = require('moment');
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
  beforeEach(done => Caller.query().truncate().nodeify(done));
  beforeEach(done => Caller.query().insert(caller).nodeify(done));

  context('with an approved number', () => {
    const payload = { From: caller.phone_number };
    it('plays the briefing message', (done) => {
      request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/Hi bob/)
        .end(done)
    });
  });

  context('with an irregular, but approved, caller id', () => {
    const payload = { From: '02 8888 8888' };
    it('still identifies our caller', (done) => {
      request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/Hi bob/)
        .end(done)
    });
  });

  context('with an unapproved number', () => {
    const payload = { From: '61266666666' };
    it('directs them to contact us', (done) => {
      request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/only approved callers/)
        .end(done)
    });
  });

  context('with a private number', () => {
    const payload = { From: 'anonymous' };
    it('directs them to contact us', (done) => {
      request.post('/connect')
        .type('form')
        .send(payload)
        .expect(/only approved callers/)
        .end(done)
    });
  });
});

describe('/call', () => {
  beforeEach(done => Callee.raw('truncate callees restart identity cascade').nodeify(done));

  context('with an approved caller', () => {
    beforeEach(done => Caller.query().insert(caller).nodeify(done));

    context('and only one associated callee', () => {
      beforeEach(done => Callee.query().insert(unassociatedCallee).nodeify(done));
      beforeEach(done => Callee.query().insert(associatedCallee).nodeify(done));

      context('which has already been called', () => {
        beforeEach(done => request.post(`/call?caller_number=${caller.phone_number}`).expect(/chris/).end(done));

        it('will not call again', (done) => {
          request.post('/call').expect(/no more numbers left to call/).end(done)
        });
      });

      context('after 7 days', () => {
        beforeEach(done => {
          timekeeper.travel(moment().subtract(7, 'days').toDate());
          request.post(`/call?caller_number=${caller.phone_number}`).end(() => {
            timekeeper.reset();
            done();
          });
        });

        it('allows callees to be called again', (done) => {
          request.post(`/call?caller_number=${caller.phone_number}`).expect(/chris/).end(done)
        });
      });
    });
  });
});

describe('/call_log', () => {
  beforeEach(done => Call.query().truncate().nodeify(done));
  beforeEach(done => Callee.query().insert(unassociatedCallee).nodeify(done));
  beforeEach(done => {
    request.post(`/call_log?callee_number=61299999999`)
      .type('form')
      .send({DialBLegTo: '61299999999'})
      .end(done)
  });

  it('stores call records', (done) => {
    Call.query().then(data => {
      expect(data).to.have.length(1);
      expect(data[0].callee_number).to.be('61299999999');
      done();
    }).catch(done);
  });
});

describe('/hangup', () => {
  beforeEach(done => Call.query().truncate().nodeify(done));
  const payload = { DialBLegTo: '61400999000' };
  const call = (startTime) => {
    return {
      created_at: startTime.toDate(),
      status: 'answer',
      callee_number: payload.DialBLegTo,
    }
  };

  context('with a long duration call', () => {
    const record = call(moment().subtract(10, 'seconds'));
    beforeEach(done => Call.query().insert(record).nodeify(done))

    it('prompts for survey answers', (done) => {
      request.post('/hangup')
        .type('form')
        .send(payload)
        .expect(200)
        .expect('Content-Type', /xml/)
        .expect(/^((?!call_again).)*$/)
        .expect(/survey/)
        .end(done);
    });
  });

  context('with a short duration call', () => {
    const record = call(moment().subtract(9, 'seconds'));
    beforeEach(done => Call.query().insert(record).nodeify(done))

    it('skips the survey; just calls again', (done) => {
      request.post('/hangup')
        .type('form')
        .send(payload)
        .expect(200)
        .expect('Content-Type', /xml/)
        .expect(/^((?!survey).)*$/)
        .expect(/call_again/)
        .end(done);
    });
  });

  context('without a call_log record', () => {
    it('defaults to prompting for survey answers', (done) => {
      request.post('/hangup')
        .type('form')
        .send(payload)
        .expect(200)
        .expect('Content-Type', /xml/)
        .expect(/^((?!call_again).)*$/)
        .expect(/survey/)
        .end(done);
    });
  });
});

describe('survey question persistence', () => {
  beforeEach((done) => SurveyResult.query().truncate().nodeify(done))

  it('is persisted with user details', (done) => {
    const UUID = 'fakeUUID'
    const DialBLegTo = '61299999999'
    request
      .post(`/survey_result?q=rsvp&calleeUUID=${UUID}&calleeNumber=${DialBLegTo}`)
      .type('form')
      .send({ Digits: '2' })
      .expect(200)
      .expect('Content-Type', /xml/)
      .expect(/call_again/)
      .end((err, res) => {
        if (err) return done(err);

        SurveyResult.query()
          .where('callee_uuid', UUID)
          .then((data) => {
            expect(data).to.have.length(1);
            expect(data[0].callee_uuid).to.be(UUID);
            done();
          })
          .catch(done);
      });
  });

  it('stores the answer, not the digit', (done) => {
    request
      .post('/survey_result')
      .type('form')
      .send({ Digits: '3' })
      .end((err, res) => {
        if (err) return done(err);

        SurveyResult.query().then((data) => {
          expect(data).to.have.length(1);
          expect(data[0].answer).to.be('maybe');
          done();
        })
        .catch(done);
      });
  });
});

describe('logging', () => {
  beforeEach((done) => Log.raw('truncate logs restart identity cascade').nodeify(done));

  const UUID = 'asdfghjkl';
  const payload = { CallUUID: UUID };
  const endpoints = app._router.stack
    .filter(r => r.route).map(r => r.route.path);

  endpoints.forEach(endpoint => {
    it(`occurs for ${endpoint}`, (done) => {
      request
        .post(endpoint)
        .type('form')
        .send(payload)
        .end((err, res) => {
          if (err) return done(err);

          Log.query().then((data) => {
            expect(data).to.have.length(1);
            expect(data[0].UUID).to.equal(UUID);
            expect(data[0].url).to.equal(endpoint);
            expect(data[0].body).to.eql(payload);
            done();
          })
          .catch(done);
        });
    });
  });

  it('does not occur for GET requests', (done) => {
    request.get('/').end((err, res) => {
      if (err) return done(err);

      Log.query().then((data) => {
        expect(data).to.have.length(0);
        done();
      })
      .catch(done);
    });
  });

  it('returns the log id so we can associate it w/ other things', (done) => {
    request
      .post('/survey_result')
      .type('form')
      .send(payload)
      .end((err, res) => {
        if (err) return done(err);

        SurveyResult.query()
          .then((data) => {
            expect(data).to.have.length(1);
            expect(data[0].log_id).to.equal('1');
            done();
          })
          .catch(done);
      });
  });
});

describe('routing', () => {
  beforeEach(done => Callee.query().insert(caller).nodeify(done));
  beforeEach(done => Callee.query().insert(associatedCallee).nodeify(done));
  it('/call redirects to hangup & calls back to call_log', (done) => {
    request.post(`/call?caller_number=${caller.phone_number}`)
      .expect(/Redirect\>http:\/\/127.0.0.1\/hangup/)
      .expect(/callbackUrl="http:\/\/127.0.0.1\/call_log/)
      .end(done);
  });
});
