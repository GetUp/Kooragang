const expect = require('expect.js');
const nock = require('nock');
const proxyquire = require('proxyquire');
const moment = require('moment');
const ivrCaller = proxyquire('../../ivr/caller', {
  '../dialer': {
    dial: async (appUrl) => {},
    calledEveryone: async (appUrl) => false,
  }
});
const app = require('../../ivr/common');
app.use(ivrCaller);
const request = require('supertest')(app);

const {
  Campaign,
  User,
  Team
} = require('../../models');

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
  await Campaign.query().delete();
  await Team.query().delete();
  await User.query().delete();
});
beforeEach(async () => campaign = await Campaign.query().insert(teamsCampaign));
beforeEach(async () => team = await Team.query().insert({name: 'planet savers', passcode: '1234'}));
beforeEach(async () => user = await User.query().insert({phone_number: '098765', team_id: team.id}));

describe('/team', () => {

  context('with no existing user', () => {
    const payload = { From: '098765' };
    beforeEach(async () => { await User.query().delete() });
    it('creates new user record', async () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload);
      user = await User.query().where({phone_number: '098765'}).first();
      expect(user).to.be.an(User);
    });
  });
  context('with existing user', () => {
    const payload = { From: '098765' };
    it('creates no new user record', async () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload);
      count = await User.query().count();
      expect(count).to.be(1);
    });
  });
  context('with 1 pressed', () => {
    const payload = { Digits: '1', From: '098765' };
    it('announces user rejoined team & redirect to connect', () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/rejoined/);
    });
  });
  context('with 2 pressed', () => {
    const payload = { Digits: '2', From: '098765' };
    it('prompts for team passcode', () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/Please enter/);
    });
  });
  context('with * pressed', () => {
    const payload = { Digits: '*', From: '098765' };
    it('remove team id from user', async () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload);
      user = await User.query().where({phone_number: '098765'}).first();
      expect(user.team_id).to.be(null);
    });
    it('announces user running solo & redirect to connect', () => {
      return request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload)
        .expect(/running solo/)
        .expect(/connect/);
    });
  });
});

describe('/team/join', () => {
    context('with an unknown number', () => {
      const payload = { Digits: '1234', };
      it('announces user joined team & redirect to connect', () => {
        return request.post(`/team/join?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/joined/)
          .expect(/connect\?campaign_id\=1\&team\=1/);
      });
      it('announces user joined team & redirect to connect', () => {
        return request.post(`/team/join?campaign_id=${campaign.id}`)
          .type('form')
          .send(payload)
          .expect(/joined/)
          .expect(/connect\?campaign_id\=1\&team\=1/);
      });
    });
});
