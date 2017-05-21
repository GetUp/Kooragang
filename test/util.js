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
  return Promise.all([Event, SurveyResult, Call, Caller, User, Team, Redirect, Callee, Campaign].map(model => model.query().delete()))
}
