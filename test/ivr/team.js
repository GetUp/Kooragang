const expect = require('expect.js')
const nock = require('nock')
const proxyquire = require('proxyquire')
const moment = require('moment')
const ivrCaller = proxyquire('../../ivr/team', {
  '../dialer': {
    dial: async (appUrl) => {}
  }
})
const app = require('../../ivr/common')
app.use(ivrCaller)
const request = require('supertest')(app)
const {dropFixtures} = require('../test_helper')

const {
  Campaign,
  User,
  Team
} = require('../../models')

const teamsCampaign = {
  id: 1,
  name: 'test',
  phone_number: '1111',
  sms_number: '22222222',
  status: 'active',
  teams: true
}

let campaign
let team
let user
beforeEach(async () => {
  await dropFixtures()
})
beforeEach(async () => team = await Team.query().insert({name: 'planet savers', passcode: '1234'}))
beforeEach(async () => user = await User.query().insert({phone_number: '098765', team_id: team.id}))

describe('/team', () => {
  beforeEach(async () => {
    await Campaign.query().delete()
    campaign = await Campaign.query().insert(teamsCampaign)
  })
  context('with no existing user', () => {
    const payload = { From: '098765' }
    beforeEach(async () => { await User.query().delete() })
    it('creates new user record', async () => {
      await request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
      user = await User.query().where({phone_number: '098765'}).first()
      expect(user).to.be.an(User)
    })
  })
  context('with existing user', () => {
    const payload = { From: '098765' }
    it('creates no new user record', async () => {
      await request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
      let users = await User.query()
      expect(users.length).to.be(1)
    })
  })
  context('with 1 pressed', () => {
    const payload = { Digits: '1', From: '098765' }
    it('announces user rejoined team & redirect to connect', () => {
      return request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/rejoined/)
    })
  })
  context('with 2 pressed', () => {
    const payload = { Digits: '2', From: '098765' }
    it('prompts for team passcode within the digit prompt', () => {
      return request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/Please enter.*<\/Speak><\/GetDigits/)
    })
  })
  context('with * pressed', () => {
    const payload = { Digits: '*', From: '098765' }
    it('remove team id from user', async () => {
      await request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
      user = await User.query().where({phone_number: '098765'}).first()
      expect(user.team_id).to.be(null)
    })
    it('announces user calling without a team & redirect to connect', () => {
      return request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/without a team/)
        .expect(/connect/)
    })
  })
})

describe('/team/join', () => {
  beforeEach(async () => {
    await Campaign.query().delete()
    campaign = await Campaign.query().insert(teamsCampaign)
  })
  context('with a passcode that matches an existing team', () => {
    it('announces user joined team & redirect to connect', () => {
      const payload = { Digits: '1234'}
      return request.post(`/team/join?campaign_id=${campaign.id}&user_id=${user.id}`)
        .type('form')
        .send(payload)
        .expect(/joined/)
        .expect(/connect/)
        .expect(/team=1/)
    })
  })
  context('with a passcode that does not match an existing team', () => {
    it('announces passcode incorrect & redirect to connect', () => {
      const payload = { Digits: '0987'}
      return request.post(`/team/join?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/incorrect team passcode/)
        .expect(/connect/)
    })
  })
})
