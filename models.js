const env = process.env.NODE_ENV || 'development';

const config = require('./knexfile');
const knex = require('knex')(config[env]);
const Model = require('objection').Model;

Model.knex(knex);

class Log extends Model {
  static get tableName() { return 'logs' };
}

class SurveyResult extends Model {
  static get tableName() { return 'survey_results' };
}

module.exports = {
  Log,
  SurveyResult,
};
