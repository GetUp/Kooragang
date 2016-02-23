const env = process.env.NODE_ENV || 'development';

const config = require('./knexfile');
const knex = require('knex')(config[env]);
const Model = require('objection').Model;

Model.knex(knex);

class Callee extends Model {
  static get tableName() { return 'callees' };

  static get relationMappings() {
    return {
      calls: {
        relation: Model.OneToManyRelation,
        modelClass: Call,
        join: {
          from: 'callees.id',
          to: 'calls.callee_id'
        }
      }
    }
  }
}

class Call extends Model {
  static get tableName() { return 'calls' };
}

class Log extends Model {
  static get tableName() { return 'logs' };
}

class SurveyResult extends Model {
  static get tableName() { return 'survey_results' };
}

module.exports = {
  Callee,
  Log,
  SurveyResult,
};
