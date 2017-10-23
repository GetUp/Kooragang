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
  User
} = require('../models');

module.exports.dropFixtures = async() => {
  for (const model of [Event, SurveyResult, Call, Caller, User, Team, Redirect, Callee, Campaign]){
    await model.query().delete();
  }
}
