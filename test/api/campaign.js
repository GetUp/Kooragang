const expect = require('expect.js')
const app = require('../../api/index')
const request = require('supertest')(app)
const { Campaign, Audience } = require('../../models')
const nock = require('nock')
const { dropFixtures, resetAutoIncrement } = require('../test_helper')
const hours_of_operation_full = require('../../seeds/hours_of_operation_full.example.json')

const defaultCampaign = {
  id: 1,
  name: 'test1',
  phone_number: '1111',
  redirect_number: '2222',
  max_call_attempts: 1,
  no_call_window: 120,
  hours_of_operation: hours_of_operation_full,
  plivo_setup_status: 'complete',
  biller: 'Environmental Justice',
  owner: 'Sam Reg'
}
const secondaryCampaign = Object.assign({}, defaultCampaign, {name: 'test2'})
const alteredNumberRegionCampaign = Object.assign({}, defaultCampaign, {number_region: 'Melbourne'})
const cloneCampaignAttributes = {
  name: 'test3',
  number_region: 'Melbourne'
}
const defaultAudience = {
  id: 1,
  list_name: 'test list',
  list_id: 2222,
  list_member_count: 111,
  imported_member_count: 110,
  status: 'complete'
}
process.env.KOORAGANG_API_HASH = 'xxxxxxxxxx'

describe('Campaign API Endpoints', ()=> {
  beforeEach(async () => {
    await dropFixtures()
    await Campaign.query().insert(defaultCampaign)
    await resetAutoIncrement('campaigns')
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
    beforeEach(async () => { await dropFixtures() })
    it('should create and return a campaign', async () => {
      const res = await request.post('/api/campaigns')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: defaultCampaign})
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data.name).to.be('test1')
      const newCampaign = await Campaign.query().first()
      expect(newCampaign).to.be.a(Campaign)
      expect(newCampaign.biller).to.be('Environmental Justice')
      expect(newCampaign.owner).to.be('Sam Reg')
      expect(newCampaign.name).to.be('test1')
    })
  })

  describe('putting a campaign', ()=> {
    it('should update and return a campaign', async () => {
      const res = await request.put('/api/campaigns/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .set('Content-type', 'application/json')
        .send({data: secondaryCampaign})
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data.name).to.be('test2')
      const updatedCampaign = await Campaign.query().first()
      expect(updatedCampaign).to.be.a(Campaign)
      expect(updatedCampaign.name).to.be('test2')
    })

    context('with altered number_region', () => {
      it('should update a campaign with plivo_setup_status needed', async () => {
        await request.put('/api/campaigns/1')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .set('Content-type', 'application/json')
          .send({data: alteredNumberRegionCampaign})
          .expect('Content-type',/json/)
          .expect(200)
        const updatedCampaign = await Campaign.query().first()
        expect(updatedCampaign).to.be.a(Campaign)
        expect(updatedCampaign.phone_number).to.be(null)
        expect(updatedCampaign.plivo_setup_status).to.be('needed')
      })
    })
  })

  describe('deleting a campaign', ()=> {
    it('should remove and return a campaign', async () => {
      const res = await request.delete('/api/campaigns/1')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      expect(res.body.data.name).to.be('test1')
      const campaigns = await Campaign.query()
      expect(campaigns.length).to.be(0)
    })
  })

  describe('cloning a campaign', ()=> {
    context('with empty playload', () => {
      it('should create and return a campaign', async () => {
        const res = await request.post('/api/campaigns/1/clone')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .send({data: {}})
          .expect('Content-type',/json/)
          .expect(200)
        expect(res.body.data.name).to.be('test1 - (copy1)')
        const campaigns = await Campaign.query()
        expect(campaigns.length).to.be(2)
        const newCampaign = await Campaign.query().orderBy('created_at', 'desc').first()
        expect(newCampaign).to.be.a(Campaign)
        expect(newCampaign.name).to.be('test1 - (copy1)')
      })
    })
    context('with data in the playload', () => {
      it('should create and return a campaign', async () => {
        const res = await request.post('/api/campaigns/1/clone')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .send({data: cloneCampaignAttributes})
          .expect('Content-type',/json/)
          .expect(200)
        expect(res.body.data.name).to.be('test3')
        const campaigns = await Campaign.query()
        expect(campaigns.length).to.be(2)
        const newCampaign = await Campaign.query().orderBy('created_at', 'desc').first()
        expect(newCampaign).to.be.a(Campaign)
        expect(newCampaign.name).to.be('test3')
        expect(newCampaign.number_region).to.be('Melbourne')
      })
    })
  })

  describe('testing a campaign', ()=> {

    context('with a valid mobile', () => {
      const mobile_number = '6141222222222'
      it('should dial the mobile number', async () => {
        const createApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => {
            return body.to === mobile_number
          })
          .query(true)
          .reply(200)
        await request.post('/api/campaigns/1/assessment')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .send({data: { mobile_number }})
          .expect('Content-type',/json/)
          .expect(200)
        createApiCall.done()
      })
    })

    context('with an error on the plivo call', () => {
      const mobile_number = '6141222222222'
      it('should dial the mobile number', async () => {
        const createApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => {
            return body.to === mobile_number
          })
          .query(true)
          .reply(500, 'some error')
        await request.post('/api/campaigns/1/assessment')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .send({data: { mobile_number }})
          .expect('Content-type',/json/)
          .expect(500, /API call/)
        createApiCall.done()
      })
    })

    context('with a number missing the country code', () => {
      const mobile_number = '041111111'
      it('should dial the mobile number', async () => {
        const createApiCall = nock('https://api.plivo.com')
          .post(/Call/, body => {
            return body.to === '6141111111'
          })
          .query(true)
          .reply(200)
        await request.post('/api/campaigns/1/assessment')
          .set('Accept', 'application/json')
          .set('Authorization', process.env.KOORAGANG_API_HASH)
          .send({data: { mobile_number }})
          .expect('Content-type',/json/)
          .expect(200)
        createApiCall.done()
      })
    })
  })

  describe('fetching campaign audiences', ()=> {
    beforeEach(async () => {
      await dropFixtures()
      const campaign = await Campaign.query().insert(defaultCampaign)
      await Audience.query().insert(Object.assign({}, defaultAudience, {campaign_id: campaign.id}))
    })
    it('should return an array of attributed audiences', async () => {
      const res = await request.get('/api/campaigns/1/audiences')
        .set('Accept', 'application/json')
        .set('Authorization', process.env.KOORAGANG_API_HASH)
        .expect('Content-type',/json/)
        .expect(200)
      const audience = res.body.data[0]
      expect(audience.id).to.be(1)
      expect(audience.list_name).to.be('test list')
      expect(audience.list_id).to.be('2222')
      expect(audience.list_member_count).to.be('111')
      expect(audience.imported_member_count).to.be('110')
      expect(audience.status).to.be('complete')
    })
  })
})

