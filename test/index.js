const app = require('../dialer');
const request = require('supertest')(app);
const expect = require('expect.js');
const { Log, SurveyResult } = require('../models');

describe('survey question', () => {
  it.skip('is asked when the caller has a conversation longer than 10s', (done) => {
    const long_convo = { DialBLegDuration: "11" };
    request
      .post('/hangup')
      .type('form')
      .send(long_convo)
      .expect(200)
      .expect('Content-Type', /xml/)
      .expect(/^((?!call_again).)*$/)
      .expect(/survey/)
      .end(done);
  });

  it.skip('is not asked when the caller has a conversation of 10s or shorter', (done) => {
    const short_convo = { DialBLegDuration: "1" };
    request
      .post('/hangup')
      .type('form')
      .send(short_convo)
      .expect(200)
      .expect('Content-Type', /xml/)
      .expect(/call_again/)
      .expect(/survey/)
      .end(done);
  });
});

describe('survey question persistence', () => {
  beforeEach((done) => SurveyResult.query().truncate().nodeify(done))

  it('is persisted with user details', (done) => {
    const UUID = "fakeUUID"
    const DialBLegTo = "61299999999"
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
  beforeEach((done) => Log.query().truncate().nodeify(done))

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
});

describe('routing', () => {
  it('connect should redirect to call', (done) => {
    request.post('/connect')
      .expect(/Redirect\>http:\/\/127.0.0.1\/call/)
      .end(done);
  });

  it('/call redirects to hangup & calls back to log', (done) => {
    request.post('/call')
      .expect(/Redirect\>http:\/\/127.0.0.1\/hangup/)
      .expect(/callbackUrl="http:\/\/127.0.0.1\/log/)
      .end(done);
  });
});
