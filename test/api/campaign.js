const expect = require('expect.js')
const app = require('../../api/index')
const request = require('supertest')(app)
const { Campaign } = require('../../models')
const hours_of_operation_full = require('../../seeds/hours_of_operation_full.example.json')

const defaultCampaign = {
  id: 1,
  name: 'test1',
  phone_number: '1111',
  redirect_number: '2222',
  max_call_attempts: 1,
  no_call_window: 120,
  hours_of_operation: hours_of_operation_full,
  biller: 'Environmental Justice',
  owner: 'Sam Reg'
}
const secondaryCampaign = Object.assign({}, defaultCampaign, {name: 'test2'})
process.env.KOORAGANG_API_HASH = 'xxxxxxxxxx'

describe('Campaign API Endpoints', ()=> {
  beforeEach(async () => {
    await Campaign.query().delete()
    await Campaign.query().insert(defaultCampaign)
  })

  describe('fetching campaigns', ()=> {
    it('should return campaigns', async () => {
      const res = await request.get('/api/campaigns')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data[0].name).to.be('test1')
      expect(res.body.data.length).to.be(1)
    })
  })

  describe('fetching a campaign', ()=> {
    it('should return a campaign', async () => {
      const res = await request.get('/api/campaigns/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data.name).to.be('test1')
    })
  })

  describe('posting a campaign', ()=> {
    beforeEach(async () => { await Campaign.query().delete() })
    it('should create a campaign', async () => {
      const res = await request.post('/api/campaigns')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: defaultCampaign})
        .expect('Content-type',/json/)
        .expect(200)
      const newCampaign = await Campaign.query().first()
      expect(newCampaign).to.be.a(Campaign)
      expect(newCampaign.biller).to.be('Environmental Justice')
      expect(newCampaign.owner).to.be('Sam Reg')
      expect(newCampaign.name).to.be('test1')
    })
  })

  describe('putting a campaign', ()=> {
    it('should update a campaign', async () => {
      const res = await request.put('/api/campaigns/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: secondaryCampaign})
        .expect('Content-type',/json/)
        .expect(200)
      const updatedCampaign = await Campaign.query().first()
      expect(updatedCampaign).to.be.a(Campaign)
      expect(updatedCampaign.name).to.be('test2')
    })
  })

  describe('deleting a campaign', ()=> {
    it('should remove a campaign', async () => {
      const res = await request.delete('/api/campaigns/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      const campaigns = await Campaign.query()
      expect(campaigns.length).to.be(0)
    })
  })
})
