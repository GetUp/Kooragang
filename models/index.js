const env = process.env.NODE_ENV || 'development'
const moment = require('../api/moment')
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
      'calledEveryone',
      'isRatioDialing',
      'isWithinOptimalCallingTimes'
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
  timezone() {
    if (this.hours_of_operation_timezone && moment.tz.zone(this.hours_of_operation_timezone)) {
      return this.hours_of_operation_timezone
    }
    return process.env.TZ || 'Australia/Sydney'
  }
  isWithinDailyTimeOfOperation() {
    const todays_hours = this.hours_of_operation[_.lowerCase(moment.tz(this.timezone()).format('dddd'))]
    if (_.isNull(todays_hours)) return false
    const start = moment.tz(todays_hours['start'], 'HHmm', this.timezone())
    const stop = moment.tz(todays_hours['stop'], 'HHmm', this.timezone())
    return moment.tz(this.timezone()).isBetween(start, stop, null, '[]')
  }
  dailyTimeOfOperationInWords() {
    let operating_hours_in_words = 'Please call back within the hours of '
    let running_days = [], start, stop, tomorrow_index, tomorrow_hours
    const daysOfWeek = _.keys(this.hours_of_operation)
    _.forEach(this.hours_of_operation, (hours, day) => {
      if (_.isNull(hours)) return
      running_days.push(day)
      tomorrow_index = (_.indexOf(_.keys(this.hours_of_operation), day) + 1)
      tomorrow_hours = this.hours_of_operation[daysOfWeek[tomorrow_index]]     
      if (_.isNil(tomorrow_hours) || hours.start != tomorrow_hours.start || hours.stop != tomorrow_hours.stop) {
        start = moment.tz(hours['start'], 'HHmm', this.timezone()).format('h mm a').replace(/00\s/,'')
        stop = moment.tz(hours['stop'], 'HHmm', this.timezone()).format('h mm a').replace(/00\s/,'')
        operating_hours_in_words += `${start}, and ${stop}, `
        if (running_days.length == 2) {
          operating_hours_in_words += `${_.first(running_days)} and ${_.last(running_days)}. `
        }
        else if (running_days.length > 1) {
          operating_hours_in_words += `${_.first(running_days)} to ${_.last(running_days)}. `
        } else {
          operating_hours_in_words += `on ${day}. `
        }
        running_days = []
      }
    });
    if (!_.isNull(moment.tz(this.timezone()).zoneName())) operating_hours_in_words += `${moment.tz(this.timezone()).zoneName()}. `
    return operating_hours_in_words
  }
  isWithinOptimalCallingTimes() {
    const today = _.lowerCase(moment.tz(this.timezone()).format('dddd'))
    if (_.includes(['saturday', 'sunday'], today)) return true
    const start = moment.tz('00:00:00', 'HHmm', this.timezone())
    const stop = moment.tz('17:00:00', 'HHmm', this.timezone())
    return !moment.tz(this.timezone()).isBetween(start, stop, null, '[]')
  }
  async isRatioDialing() {
    const callers = await Caller.knexQuery().where({campaign_id: this.id}).whereIn('status', ['available', 'in-call']).count().first();
    return callers.count >= this.min_callers_for_ratio
  }
  areCallsInProgress() {
    return this.calls_in_progress > 0
  }
  async calledEveryone() {
    if (this.areCallsInProgress()) return false
    const {count} = await Callee.query().count('id as count').whereIn('id', this.callableCallees()).first()
    return parseInt(count, 10) === 0
  }
  callableCallees(callsToMakeExcludingCurrentCalls=1) {
    return Callee.query()
      .leftOuterJoin('calls', 'callee_id', 'callees.id')
      .where('campaign_id', this.id)
      .whereRaw(`(last_called_at is null or last_called_at < NOW() - INTERVAL '${this.no_call_window} minutes')`)
      .groupByRaw(`
        1 having sum(case when status in ('busy', 'no-answer') then 1 else 0 end) < ${this.max_call_attempts}
        and sum(case when status not in ('busy', 'no-answer') then 1 else 0 end) = 0
      `)
      .orderByRaw(this.exhaust_callees_before_recycling ? 'count(calls.id), max(last_called_at), 1' : '1')
      .limit(callsToMakeExcludingCurrentCalls)
      .select('callees.id')
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
  async callee_total() {
    return await Callee.query().where('campaign_id', this.id).count('*')
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
