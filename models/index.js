const env = process.env.NODE_ENV || 'development'
const moment = require('moment')
const pg = require('pg')
pg.types.setTypeParser(1700, 'text', parseFloat)
const config = require('../knexfile')
const objection = require('objection')
const Model = objection.Model
const _ = require('lodash')
const Base = require('./base')

class Campaign extends Base {
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
      'calledEveryone'
    ]
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
  async isComplete() {
    return this.isInactive() || (await this.calledEveryone())
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
    return this.calls_in_progress > 0
  }
  async calledEveryone() {
    if (this.areCallsInProgress()) return false
    const callees_within_max_call_attempts = Call.query()
      .innerJoin('callees', 'callee_id', 'callees.id')
      .where('campaign_id', this.id)
      .groupByRaw(`
        1 having sum(case when status in ('busy', 'no-answer') then 1 else 0 end) < ${this.max_call_attempts}
        and sum(case when status not in ('busy', 'no-answer') then 1 else 0 end) = 0
      `)
      .select('callee_id');

    const {count} = await Callee.query().count('id as count')
      .where({campaign_id: this.id})
      .whereRaw(`last_called_at is null or last_called_at < NOW() - INTERVAL '${this.no_call_window} minutes'`)
      .whereIn('id', callees_within_max_call_attempts)
      .first();
    return parseInt(count, 10) === 0
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
        const answerData = questionData.answers[answer]
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

class Call extends Base {
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
      },
      survey_results: {
        relation: Model.HasManyRelation,
        modelClass: SurveyResult,
        join: {
          from: 'calls.id',
          to: 'survey_results.call_id'
        }
      }
    }
  }
}

class Callee extends Base {
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

class Caller extends Base {
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

class Log extends Base {
  static get tableName() { return 'logs' }
}

class SurveyResult extends Base {
  static get tableName() { return 'survey_results' }
}

class Event extends Base {
  static get tableName() { return 'events' }
}

class Team extends Base {
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

class User extends Base {
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

class Redirect extends Base {
  static get tableName() { return 'redirects' }
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
  Redirect
}
