const app = require('../dialer');
const request = require('supertest')(app);
const expect = require('expect.js');
const pgp = require('pg-promise')();
const db = pgp(process.env.DATABASE_URL || 'postgres://localhost:5432/cte');

describe('survey question', () => {
  it('is asked when the caller has a conversation longer than 10s', (done) => {
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

  it('is not asked when the caller has a conversation of 10s or shorter', (done) => {
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

describe('survey question persistance', () => {
  beforeEach((done) => db.none('TRUNCATE survey_results;').then(done).catch(done))

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

        db.query(`SELECT * FROM survey_results WHERE callee_uuid='${UUID}'`)
          .then((data) => {
            expect(data).to.have.length(1);
            expect(data[0].callee_uuid).to.be(UUID);
            done();
          })
          .catch(done);
      });

  });
});

describe('log persistance', () => {
  beforeEach((done) => db.none('TRUNCATE logs;').then(done).catch(done))

  it('is persisted', (done) => {
    const payload = { Digits: '2' };
    request
      .post(`/log`)
      .type('form')
      .send(payload)
      .end((err, res) => {
        if (err) return done(err);

        db.query(`SELECT * FROM logs`)
          .then((data) => {
            expect(data).to.have.length(1);
            expect(data[0].body).to.eql(payload);
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

  it('call should "action" to hangup & callback to log', (done) => {
    request.post('/call')
      .expect(/action="http:\/\/127.0.0.1\/hangup/)
      .expect(/callbackUrl="http:\/\/127.0.0.1\/log/)
      .end(done);
  });
});
