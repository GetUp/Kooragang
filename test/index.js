const app = require('../dialer');
const request = require('supertest')(app);
const expect = require('expect.js');
const timekeeper = require('timekeeper');
const moment = require('moment');
const { Call, Callee, Log, SurveyResult } = require('../models');

const alice = {
  first_name: 'alice',
  phone_number: '61299999999',
  location: 'drummoyne'
};
const bob = {
  first_name: 'bob',
  phone_number: '61288888888',
  location: 'balmain'
};

describe('/call', () => {
  beforeEach(done => Callee.raw('truncate callees restart identity cascade').nodeify(done));

  describe('with no callees', () => {
    it('gracefully handles no available callees', (done) => {
      request.post('/call')
        .expect(/no more numbers left to call/)
        .end(done)
    });
  });

  describe('with one callee', () => {
    beforeEach(done => Callee.query().insert(alice).nodeify(done));
    it('is callable', (done) => {
      request.post('/call')
        .expect(/alice/)
        .expect(/drummoyne/)
        .expect(/Number>61299999999/)
        .end(done)
    });
  });

  describe('with alice already called once', () => {
    beforeEach(done => Callee.query().insert(alice).nodeify(done));
    beforeEach(done => request.post('/call').end(done))

    it('doesn\'t call alice twice', (done) => {
      request.post('/call')
        .expect(/^((?!alice).)*$/)
        .expect(/no more numbers left to call/)
        .end(done)
    });
  });

  describe('after 7 days', () => {
    beforeEach(done => Callee.query().insert(alice).nodeify(done));
    beforeEach(done => {
      timekeeper.travel(moment().subtract(7, 'days').toDate());
      request.post('/call').end(() => {
        timekeeper.reset();
        done();
      });
    });

    it('allows callees to be called again', (done) => {
      request.post('/call').expect(/alice/).end(done)
    });
  })
});

describe('/call_log', () => {
  beforeEach(done => Call.query().truncate().nodeify(done));
  beforeEach(done => Callee.query().insert(alice).nodeify(done));
  beforeEach(done => {
    request.post(`/call_log?callee_number=${alice.phone_number}`)
      .type('form')
      .send({DialBLegTo: alice.phone_number})
      .end(done)
  });

  it('stores call records', (done) => {
    Call.query().then(data => {
      expect(data).to.have.length(1);
      expect(data[0].callee_number).to.be(alice.phone_number);
      done();
    }).catch(done);
  });
});

describe('/hangup', () => {
  const payload = { DialBLegTo: '61400999000' };
  const call = (startTime) => {
    return {
      created_at: startTime.toDate(),
      status: 'answer',
      callee_number: payload.DialBLegTo,
    }
  };

  describe('with a long duration call', () => {
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

  describe('with a short duration call', () => {
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
      .send({ Digits: '2' })
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
  it('connect should redirect to call', (done) => {
    request.post('/connect')
      .expect(/Redirect\>http:\/\/127.0.0.1\/call/)
      .end(done);
  });

  beforeEach(done => Callee.query().insert(alice).nodeify(done));
  it('/call redirects to hangup & calls back to log', (done) => {
    request.post('/call')
      .expect(/Redirect\>http:\/\/127.0.0.1\/hangup/)
      .expect(/callbackUrl="http:\/\/127.0.0.1\/call_log/)
      .end(done);
  });
});
