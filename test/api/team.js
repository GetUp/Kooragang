const expect = require('expect.js')
const fetch = require('isomorphic-fetch')
const app = require('../../api/index')
const request = require('supertest')(app)
const { Team, User } = require('../../models')

let request_url
const defaultTeam = {
  id: 1,
  name: 'test1',
  passcode: '1111'
}
const secondaryTeam = Object.assign({}, defaultTeam, {name: 'test2'})
process.env.KOORAGANG_API_HASH = 'xxxxxxxxxx'

describe('Team API Endpoints', ()=> {
  beforeEach(async () => {
    await User.query().delete()
    await Team.query().delete()
    const team = await Team.query().insert(defaultTeam)
  })

  describe('fetching teams', ()=> {
    it('should return teams', async () => {
      request_url = '/api/teams'
      await request.get(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
        .then(async (res) => {
          expect(res.body.data[0].name).to.be('test1')
          expect(res.body.data.length).to.be(1)
        })
    })
  })

  describe('fetching a team', ()=> {
    it('should return a team', async () => {
      request_url = '/api/teams/1'
      await request.get(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
        .then(async (res) => {
          expect(res.body.data.name).to.be('test1')
        })
    })
  })

  describe('posting a team', ()=> {
    beforeEach(async () => { await Team.query().delete() })
    it('should create a team', async () => {
      request_url = '/api/teams'
      await request.post(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: defaultTeam})
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const newTeam = await Team.query().first()
          expect(newTeam).to.be.a(Team)
          expect(newTeam.name).to.be('test1')
        })
    })
  })

  describe('putting a team', ()=> {
    it('should update a team', async () => {
      request_url = '/api/teams/1'
      await request.put(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: secondaryTeam})
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const updatedTeam = await Team.query().first()
          expect(updatedTeam).to.be.a(Team)
          expect(updatedTeam.name).to.be('test2')
        })
    })
  })

  describe('deleting a team', ()=> {
    it('should remove a team', async () => {
      request_url = '/api/teams/1'
      await request.delete(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const teams = await Team.query()
          expect(teams.length).to.be(0)
        })
    })
  })
})
