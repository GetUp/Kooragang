const env = process.env.NODE_ENV || 'development';

const config = require('./knexfile');
const knex = require('knex')(config[env]);
const objection = require('objection');
const Model = objection.Model;
const transaction = objection.transaction;

Model.knex(knex);

class Campaign extends Model {
  static get tableName() { return 'campaigns' }
  static get relationMappings() {
    return {
      callees: {
        relation: Model.OneToManyRelation,
        modelClass: Callee,
        join: {
          from: 'campaigns.id',
          to: 'callees.campaign_id'
        }
      }
    }
  }
}

class Call extends Model {
  static get tableName() { return 'calls' }
}

class Callee extends Model {
  static get tableName() { return 'callees' }

  static get relationMappings() {
    return {
      calls: {
        relation: Model.OneToManyRelation,
        modelClass: Call,
        join: {
          from: 'callees.id',
          to: 'calls.callee_id'
        }
      },
      campaign: {
        relation: Model.OneToOneRelation,
        modelClass: Campaign,
        join: {
          from: 'callees.campaign_id',
          to: 'campaigns.id'
        }
      }
    }
  }
}

class Caller extends Model {
  static get tableName() { return 'callers' }

  static get relationMappings() {
    return {
      calls: {
        relation: Model.OneToManyRelation,
        modelClass: Call,
        join: {
          from: 'callers.id',
          to: 'calls.caller_id'
        }
      }
    }
  }
}

class Log extends Model {
  static get tableName() { return 'logs' }
}

class SurveyResult extends Model {
  static get tableName() { return 'survey_results' }
}

class Event extends Model {
  static get tableName() { return 'events' }
}

module.exports = {
  Call,
  Callee,
  Caller,
  Log,
  Campaign,
  SurveyResult,
  Event,
  transaction
};
