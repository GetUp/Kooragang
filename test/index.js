const app = require('../dialer');
const request = require('supertest')(app);

describe('survey question', () => {
  it('is asked when the caller has a conversation longer than 10s', (done) => {
    let long_convo = { DialBLegDuration: "11" };
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
    let short_convo = { DialBLegDuration: "1" };
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

describe('routing', () => {
  it('connect should redirect to call', (done) => {
    request.get('/connect')
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
