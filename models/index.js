const moment = require('../api/moment')
const pg = require('pg')
pg.types.setTypeParser(1700, 'text', parseFloat)
const objection = require('objection')
const Model = objection.Model
const _ = require('lodash')
const Base = require('./base')

const campaign_virtual_attributes = [
  'isPaused',
  'isDown',
  'isInactive',
  'isComplete',
  'areCallsInProgress',
  'isWithinDailyTimeOfOperation',
  'dailyTimeOfOperationInWords',
  'calledEveryone',
  'recalculateCallersRemaining',
  'isRatioDialing',
  'isWithinOptimalCallingTimes'
]

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
    return campaign_virtual_attributes
  }
  isActive() {
    return this.status === "active"
  }
  isPausing() {
    return this.status === "pausing"
  }
  isPaused() {
    return this.status === "paused" || this.status === null
  }
  isDown() {
    return this.status === "down"
  }
  isInactive() {
    return this.status === "inactive"
  }
  async isComplete() {
    return this.isInactive() || (await this.calledEveryone())
  }
  async isOperational(){
    return this.isActive() && this.isWithinDailyTimeOfOperation() && !(await this.calledEveryone())
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
    const today = moment.tz(this.timezone()).format('YYYY-MM-DD')
    const start = moment.tz(`${today} ${todays_hours['start']}`, this.timezone())
    const stop = moment.tz(`${today} ${todays_hours['stop']}`, this.timezone())
    return moment.tz(this.timezone()).isBetween(start, stop, null, '[]')
  }
  dailyTimeOfOperationInWords(contact_method="call") {
    let operating_hours_in_words = `Please ${contact_method} back within the hours of `
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
    const optimal_calling_period_start = process.env.OPTIMAL_CALLING_PERIOD_START || '17:00:00'
    const today = _.lowerCase(moment.tz(this.timezone()).format('dddd'))
    const optimal_calling_days = process.env.OPTIMAL_CALLING_DAYS ? _.split(process.env.OPTIMAL_CALLING_DAYS, ',') : ['saturday', 'sunday']
    if (_.includes(optimal_calling_days, today)) return true
    const today_date = moment.tz(this.timezone()).format('YYYY-MM-DD')
    const start = moment.tz(`${today_date} 00:00:00`, this.timezone())
    const stop = moment.tz(`${today_date} ${optimal_calling_period_start}`, this.timezone())
    return !moment.tz(this.timezone()).isBetween(start, stop)
  }
  async isRatioDialing() {
    const callers = await Caller.knexQuery().where({campaign_id: this.id}).whereIn('status', ['available', 'in-call']).count().first();
    return callers.count >= this.min_callers_for_ratio
  }
  async areCallsInProgress() {
    return parseInt((await QueuedCall.query().where({campaign_id: this.id}).count('id as count'))[0].count, 10) > 0
  }
  async recalculateCallersRemaining() {
    const {count} = await Callee.query().count('id as count').whereIn('id', this.callableCallees()).first()
    await this.$query().patch({callers_remaining: parseInt(count, 10)})
  }
  async calledEveryone() {
    return !(await this.areCallsInProgress()) && this.callers_remaining === 0
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
  async reached_dial_in_number_channel_limit(dial_in_number, sip_header_present) {
    let callers, max_channels
    if (sip_header_present) {
      callers = await Caller.query()
        .where({
          campaign_id: this.id,
          inbound_sip: true,
          inbound_phone_number: dial_in_number,
          created_from_incoming: true
        })
        .where(function(){
          this.whereNull('status').orWhere('status', '!=', 'complete')
        })
        .count('*').first()
      max_channels = process.env.DID_NUMBER_CHANNEL_LIMIT
    } else {
      callers = await Caller.query()
        .where({
          inbound_sip: false,
          created_from_incoming: true
        })
        .where(function(){
          this.whereNull('status').orWhere('status', '!=', 'complete')
        }).count('*').first()
      max_channels = process.env.PLIVO_ACCOUNT_CHANNEL_LIMIT
    }
    return callers.count >= max_channels - process.env.CHANNEL_LIMIT_PADDING
  }

  static async nameExistant(name) {
    return !!(await this.query().where({name}).first())
  }

  static async nonExistantClonedName(original_name, new_name) {
    const name = new_name ? new_name : original_name
    if (!(await this.nameExistant(name))) return name
    for (let i = 1; i < 999; i++) {
      const appeneded_name = `${name} - (copy${i})`
      if (!(await this.nameExistant(appeneded_name))) return appeneded_name
    }
  }

  async insert_clone(data) {
    let clone = await this.$clone().$toJson()
    const strip_keys = _.concat(['id', 'created_at', 'updated_at', 'phone_number', 'redirect_number', 'calls_in_progress'], campaign_virtual_attributes)
    strip_keys.forEach(key => delete clone[key])
    clone.name = await Campaign.nonExistantClonedName(clone.name, data ? data.name : null)
    clone.number_region = data && data.number_region ? data.number_region : clone.number_region
    clone.target_number = data && data.target_number ? data.target_number : clone.target_number
    clone.status = 'inactive'
    clone.plivo_setup_status = 'needed'
    return await Campaign.query().insert(clone).returning('*').first()
  }

  plivo_setup_payload_differ(payload) {
    if (!payload.number_region) return false
    return payload.number_region != this.number_region
  }

  async update_and_patch_jobs(payload) {
    if (this.plivo_setup_payload_differ(payload)) {
      payload.plivo_setup_status = 'needed'
      payload.phone_number = null
      payload.redirect_number = null
    }
    return await this.$query().patch(payload).returning('*').first()
  }
}

class QueuedCall extends Base {
  static get tableName() { return 'queued_calls' }
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

  async last_call_today_with_no_survey_result() {
    const callers = await Caller.query()
      .whereRaw("created_at >= now()::date")
      .where({campaign_id: this.campaign_id, phone_number: this.phone_number})
      .whereNot({id: this.id})
      .orderBy('updated_at', 'desc')
      .select('callers.id')
    const caller_ids = _.map(callers, (caller) => caller.id)
    if (_.isEmpty(caller_ids)) return
    const last_call = await Call.query()
      .whereIn('caller_id', caller_ids)
      .orderBy('created_at', 'desc')
      .limit(1).first();
    if (!last_call) return
    return last_call.$query()
      .leftOuterJoin('survey_results', 'calls.id', 'survey_results.call_id')
      .whereNull('survey_results.id')
  }

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

class Audience extends Base {
  static get tableName() { return 'audiences' }
}

module.exports = {
  QueuedCall,
  Call,
  Callee,
  Caller,
  Log,
  Campaign,
  SurveyResult,
  Event,
  Team,
  User,
  Redirect,
  Audience
}
