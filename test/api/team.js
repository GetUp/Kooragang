const expect = require('expect.js')
const app = require('../../api/index')
const request = require('supertest')(app)
const { Team, User } = require('../../models')

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
    await Team.query().insert(defaultTeam)
  })

  describe('fetching teams', ()=> {
    it('should return teams', async () => {
      const res = await request.get('/api/teams')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data[0].name).to.be('test1')
      expect(res.body.data.length).to.be(1)
    })
  })

  describe('fetching a team', ()=> {
    it('should return a team', async () => {
      const res = await request.get('/api/teams/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data.name).to.be('test1')
    })
  })

  describe('posting a team', ()=> {
    beforeEach(async () => { await Team.query().delete() })
    it('should create a team', async () => {
      const res = await request.post('/api/teams')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: defaultTeam})
        .expect('Content-type',/json/)
        .expect(200)
      const newTeam = await Team.query().first()
      expect(newTeam).to.be.a(Team)
      expect(newTeam.name).to.be('test1')
    })
  })

  describe('putting a team', ()=> {
    it('should update a team', async () => {
      const res = await request.put('/api/teams/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: secondaryTeam})
        .expect('Content-type',/json/)
        .expect(200)
      const updatedTeam = await Team.query().first()
      expect(updatedTeam).to.be.a(Team)
      expect(updatedTeam.name).to.be('test2')
    })
  })

  describe('deleting a team', ()=> {
    it('should remove a team', async () => {
      const res = await request.delete('/api/teams/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      const teams = await Team.query()
      expect(teams.length).to.be(0)
    })
  })
})
