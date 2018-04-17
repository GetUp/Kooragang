// unset env vars that break the tests
process.env.BASE_URL = ''
process.env.PLIVO_API_ID = ''
process.env.PLIVO_API_TOKEN = ''

const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  SurveyResult,
  Redirect,
  Team,
  User,
  Audience,
  QueuedCall
} = require('../models');

module.exports.dropFixtures = async() => {
  for (const model of [QueuedCall, Event, SurveyResult, Call, Caller, User, Team, Redirect, Callee, Audience, Campaign]){
    await model.query().delete();
  }
}