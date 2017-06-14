const expect = require('expect.js')
const fetch = require('isomorphic-fetch')
const app = require('../../api/index')
const request = require('supertest')(app)
const { Campaign } = require('../../models')

let request_url
const defaultCampaign = {
  id: 1,
  name: 'test1',
  phone_number: '1111',
  redirect_number: '2222'
}
const secondaryCampaign = Object.assign({}, defaultCampaign, {name: 'test2'})
process.env.KOORAGANG_API_HASH = 'xxxxxxxxxx'

describe('Campaign API Endpoints', ()=> {
  beforeEach(async () => {
    await Campaign.query().delete()
    const campaign = await Campaign.query().insert(defaultCampaign)
  })

  describe('fetching campaigns', ()=> {
    it('should return campaigns', async () => {
      request_url = '/api/campaigns'
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

  describe('fetching a campaign', ()=> {
    it('should return a campaign', async () => {
      request_url = '/api/campaigns/1'
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

  describe('posting a campaign', ()=> {
    beforeEach(async () => { await Campaign.query().delete() })
    it('should create a campaign', async () => {
      request_url = '/api/campaigns'
      await request.post(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: defaultCampaign})
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const newCampaign = await Campaign.query().first()
          expect(newCampaign).to.be.a(Campaign)
          expect(newCampaign.name).to.be('test1')
        })
    })
  })

  describe('putting a campaign', ()=> {
    it('should update a campaign', async () => {
      request_url = '/api/campaigns/1'
      await request.put(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: secondaryCampaign})
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const updatedCampaign = await Campaign.query().first()
          expect(updatedCampaign).to.be.a(Campaign)
          expect(updatedCampaign.name).to.be('test2')
        })
    })
  })

  describe('deleting a campaign', ()=> {
    it('should remove a campaign', async () => {
      request_url = '/api/campaigns/1'
      await request.delete(request_url)
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
        .then(async () => {
          const campaigns = await Campaign.query()
          expect(campaigns.length).to.be(0)
        })
    })
  })
})
