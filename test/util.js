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
