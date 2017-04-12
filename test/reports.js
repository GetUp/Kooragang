const expect = require('expect.js');
const nock = require('nock');
const moment = require('moment');
const app = require('../reports');
const request = require('supertest-as-promised')(app);
const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  SurveyResult
} = require('../models');
const questions = require('../seeds/questions.example.json');
const more_info = require('../seeds/more_info.example.json');
const defaultCampaign = {
  id: 1,
  name: 'test',
  questions: questions,
  more_info: more_info,
  phone_number: '1111',
  sms_number: '22222222'
}
const activeCampaign = Object.assign({status: 'active'}, defaultCampaign)

describe('/stats/:id', () => {
  beforeEach(async () => {
    await Event.query().delete();
    await Call.query().delete();
    await Callee.query().delete();
    await Campaign.query().delete();
    await Caller.query().delete();
  });
  beforeEach(async () => campaign = await Campaign.query().insert(activeCampaign));

  it ('should return a page with the campaign name', () => {
    return request.get(`/stats/${campaign.id}`)
      .expect(/test/);
  });
});

module.exports = app;
