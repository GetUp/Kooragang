const env = process.env.NODE_ENV || 'development';

const pg = require('pg');
pg.types.setTypeParser(1700, 'text', parseFloat)
const config = require('../knexfile');
const knex = require('knex')(config[env]);
const objection = require('objection');
const Model = objection.Model;
const transaction = objection.transaction;
const _ = require('lodash');

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
  valid() {
    const errors = []
    const questionsNotReferenced = _.omit(this.questions, 'disposition')
    if (!this.questions.disposition) errors.push('disposition question required')
    for (let question in this.questions) {
      const questionData = this.questions[question]
      for (let field of ['name', 'answers']) {
        if (!questionData[field]) errors.push(`${question} question requires ${field}`)
      }
      for (let answer in questionData.answers) {
        const answerData = questionData.answers[answer];
        if (!answer.match(/^[2-9]$/)) errors.push(`answer ${answer} for ${question} question is not valid`)
        if (!answerData.value) errors.push(`answer ${answer} for ${question} question is missing value`)
          if (answerData.next){
            if (!this.questions[answerData.next]) errors.push(`${answerData.next} next for answer ${answer} in ${question} question has invalid next`)
            delete questionsNotReferenced[answerData.next]
          }
      }
    }
    if (Object.keys(questionsNotReferenced).length) errors.push(`no references to ${Object.keys(questionsNotReferenced).join(', ')}`)
    if (errors.length) {
      throw new objection.ValidationError({ questions: errors.map(e => { return { message: e }}) })
    }
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
