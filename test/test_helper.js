// unset env vars that break the tests
process.env.BASE_URL = ''
process.env.PLIVO_API_ID = ''
process.env.PLIVO_API_TOKEN = ''
const config = require('../knexfile')
const knex = require('knex')(config['test'])

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
} = require('../models')

module.exports.dropFixtures = async() => {
  const fixtureModels = [
    QueuedCall,
    Event,
    SurveyResult,
    Call,
    Caller,
    User,
    Team,
    Redirect,
    Callee,
    Audience,
    Campaign
  ]
  for (const model of fixtureModels){
    await model.query().delete()
  }
}

module.exports.resetAutoIncrement = async (table_name) => {
  const result = await knex.select(knex.raw('max(id)+1 as new_id')).from(table_name)
  await knex.schema.raw(`ALTER SEQUENCE "${table_name}_id_seq" RESTART WITH ${result[0].new_id}`)
}
