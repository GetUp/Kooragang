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
  const payload = { From: '098765' };

  context('with no existing user', () => {
    beforeEach(async () => { await User.query().delete() });
    it('creates new user record', async () => {
      request.post(`/team?campaign_id=${campaign.id}`)
        .type('form')
        .send(payload);
      user = await User.query().where({phone_number: '098765'}).first();
      return expect(user).to.be.an(User);
    });
  });
  context('with existing user', () => {
    it('creates no new user record', () => {
    });
  });
  context('with 1 pressed', () => {
    it('announces user rejoined team & redirect to connect', () => {
    });
  });
  context('with 2 pressed', () => {
    it('prompts for team passcode', () => {
    });
  });
  context('with * pressed', () => {
    it('remove team id from user', () => {
    });
    it('announces user running solo & redirect to connect', () => {
    });
  });
});
/*
- no existing user - create new user
- existing user - ceate no new user
- digit 1 `rejoined` & redirect to connect with 1 team param
- digit 2 `Please enter` & redirect to team/join
- digit * user with team id now has null team id
- digit * `running solo` & redirect to connect with 0 team param
*/

describe('/team/join', () => {
    context('with an unknown number', () => {
      const payload = { CallUUID: '1231' };
      it('create a record', async() => {
        await request.post(startPath)
          .type('form')
          .send(payload)
          .expect(/call queue/i);
        const foundCaller = await Caller.query().where({phone_number: caller.phone_number}).first();
        expect(foundCaller).to.be.a(Caller);
      });
    });
});
