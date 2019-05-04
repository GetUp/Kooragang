const expect = require('expect.js')
const app = require('../../api/index')
const request = require('supertest')(app)
const moment = require('moment')
const {
  Call,
  Callee,
  Caller,
} = require('../../models')

describe('Statistics Endpoints', () => {
  beforeEach(async () => {
    await Call.query().delete()
    await Callee.query().delete()
    await Caller.query().delete()
    const caller_id = await Caller.query().insert().id
    const callee_id = await Callee.query().insert().id
    await Call.query().insert({ caller_id, callee_id, ended_at: moment().format() })
  })

  describe('/api/calls_count_today', () => {
    it('returns all calls so far today & does not require authentication', async () => {
      const res = await request.get('/api/calls_count_today')
        .expect('Content-type', /json/)
        .expect(200)
      expect(res.body.data).to.eql({ count: '1' })
    })
  })
})
