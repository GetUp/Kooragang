const env = process.env.NODE_ENV || 'development';

const moment = require('moment');
const pg = require('pg');
pg.types.setTypeParser(1700, 'text', parseFloat)
const config = require('../knexfile');
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
        relation: Model.HasManyRelation,
        modelClass: Callee,
        join: {
          from: 'campaigns.id',
          to: 'callees.campaign_id'
        }
      }
    }
  }
  static get virtualAttributes() {
    return [
      'isPaused',
      'isInactive',
      'isComplete',
      'isWithinDailyTimeOfOperation',
      'dailyTimeOfOperationInWords',
      'areCallsInProgress',
      'areCalleesRemaining',
      'calledEveryone'
    ];
  }
  isPausing() {
    return this.status === "pausing"
  }
  isPaused() {
    return this.status === "paused" || this.status === null
  }
  isInactive() {
    return this.status === "inactive"
  }
  isComplete() {
    return this.isInactive() || this.calledEveryone()
  }
  isWithinDailyTimeOfOperation() {
    const start = moment(this.daily_start_operation, 'HHmm')
    const stop = moment(this.daily_stop_operation, 'HHmm')
    return moment().isBetween(start, stop, null, '[]')
  }
  dailyTimeOfOperationInWords() {
    const start = moment(this.daily_start_operation, 'HHmm').format('h mm a').replace(/00\s/,'')
    const stop = moment(this.daily_stop_operation, 'HHmm').format('h mm a').replace(/00\s/,'')
    return `Please call back within the hours of ${start}, and ${stop}.`
  }
  areCallsInProgress() {
    this.calls_in_progress > 0
  }
  async calledEveryone() {
    if (this.areCallsInProgress()) return false;
    const {count} = await Callee.query().count('id as count')
      .where({campaign_id: this.id})
      .whereNull('last_called_at').first();
    return parseInt(count, 10) === 0;
  }
  async areCalleesRemaining() {
    return !this.areCalleesRemaining()
  }
}

class Call extends Model {
  static get tableName() { return 'calls' }
  static get relationMappings() {
    return {
      callee: {
        relation: Model.BelongsToOneRelation,
        modelClass: Callee,
        join: {
          from: 'calls.callee_id',
          to: 'callees.id'
        }
      }
    }
  }
}

class Callee extends Model {
  static get tableName() { return 'callees' }

  static get relationMappings() {
    return {
      calls: {
        relation: Model.HasManyRelation,
        modelClass: Call,
        join: {
          from: 'callees.id',
          to: 'calls.callee_id'
        }
      },
      campaign: {
        relation: Model.BelongsToOneRelation,
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
        relation: Model.HasManyRelation,
        modelClass: Call,
        join: {
          from: 'callers.id',
          to: 'calls.caller_id'
        }
      },
      team: {
        relation: Model.BelongsToOneRelation,
        modelClass: Team,
        join: {
          from: 'callers.team_id',
          to: 'teams.id'
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

class Team extends Model {
  static get tableName() { return 'teams' }

  static get relationMappings() {
    return {
      users: {
        relation: Model.HasManyRelation,
        modelClass: User,
        join: {
          from: 'teams.id',
          to: 'users.team_id'
        }
      }
    }
  }
}

class User extends Model {
  static get tableName() { return 'users' }
  static get relationMappings() {
    return {
      team: {
        relation: Model.BelongsToOneRelation,
        modelClass: Team,
        join: {
          from: 'users.team_id',
          to: 'teams.id'
        }
      }
    }
  }
}

module.exports = {
  Call,
  Callee,
  Caller,
  Log,
  Campaign,
  SurveyResult,
  Event,
  Team,
  User,
  transaction,
  knex
};
