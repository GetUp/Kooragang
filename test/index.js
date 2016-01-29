const app = require('../dialer');
const request = require('supertest')(app);

describe('Are you awake?', () => {
  it('is awake', (done) => {
    request.get('/')
      .expect('Content-Type', /xml/)
      .expect(200)
      .expect(/awake/)
      .end(done);
  });
});
