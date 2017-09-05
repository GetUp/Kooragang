const app = require('express')()
const env = process.env.NODE_ENV || 'development'
const _ = require('lodash')
const moment = require('moment')
const config = require('../knexfile_read_only')   
const knex = require('knex')(config[env])
const { modelsBoundReadOnly } = require('../utils')
const { Campaign, Call, Caller, Callee, Event, Team } = modelsBoundReadOnly(require('../models'))
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")

//campaign stats
app.get('/api/campaigns/:id/statistics', wrap(async (req, res, next) => {
  const graph = !!req.query.graph
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campagin Exists With ID: ' + req.params.id))
  const generateReport = async () => {
    let validation_errors
    try{
      campaign.valid()
    } catch(e) {
      validation_errors = _.map(e.data.questions, 'message').join(' and ')
    }

    const caller_counts = await Caller.knexQuery().select('status')
      .count('callers.id as count')
      .whereRaw("created_at >= NOW() - INTERVAL '60 minutes'")
      .where({campaign_id: campaign.id})
      .groupBy('status');
    const status_counts = await Call.knexQuery().select('dropped')
      .innerJoin('callees', 'calls.callee_id', 'callees.id')
      .count('calls.id as count')
      .whereRaw("ended_at >= NOW() - INTERVAL '10 minutes'")
      .where({campaign_id: campaign.id})
      .groupBy('dropped');
    const tech_issues = await Event.query()
      .count('events.id as count')
      .where({campaign_id: campaign.id, name: 'technical_issue_reported'});
    const tech_issues_reported = _.sumBy(tech_issues, ({count}) => parseInt(count, 10));
    const wait_events = await Event.query()
      .whereIn('name', ['caller_complete', 'answered'])
      .where({campaign_id: campaign.id})
      .whereRaw("created_at >= NOW() - INTERVAL '10 minutes'");
    const callee_total = await campaign.callee_total();
    const callee_remaining = await campaign.callableCallees(999999);
    const callee_called = await Callee.knexQuery()
      .count('callees.id as count')
      .where({campaign_id: campaign.id})
      .whereNotNull('last_called_at');

    const average_wait_time = wait_events.length ? Math.round(_.sumBy(wait_events, event => JSON.parse(event.value).seconds_waiting) / wait_events.length) : 0;
    const total_calls = _.sumBy(status_counts, ({count}) => parseInt(count, 10));
    const drop_status = _.find(status_counts, ({dropped}) => dropped);
    const drops = drop_status ? parseInt(drop_status.count, 10) : 0;
    const drop_rate = total_calls ? Math.round(drops*100/total_calls) : 0;
    const getCountForStatus = (status) => {
      const record = _.find(caller_counts, (record) => record.status === status);
      return record ? parseInt(record.count, 10) : 0;
    }
    const callee_total_count = callee_total ? parseInt(callee_total[0].count, 10) : 0;
    const callee_remaining_count = callee_remaining.length;
    const callee_called_count = parseInt(callee_called[0].count);
    const data = {
      timestamp: moment().format('HH:mm:ss'),
      average_wait_time,
      total_calls,
      drops,
      drop_rate,
      callers_available: getCountForStatus('available'),
      callers_in_call: getCountForStatus('in-call'),
      callers_complete: getCountForStatus('complete'),
      tech_issues_reported,
      validation_errors,
      callee_total_count,
      callee_remaining_count,
      callee_called_count
    };

    if (true) {
      const time_period_in_hours = 24;
      const calls_in_progress = await Event.raw(`
          select created_at, ((value::json)->>'calls_in_progress')::integer as calls_in_progress from events
          where campaign_id = ${campaign.id}
          and (value::json)->'calls_in_progress' is not null
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const ratio_data = await Event.raw(`
          select created_at, (value::json)->>'ratio' as ratio from events
          where campaign_id = ${campaign.id}
          and name = 'ratio'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const drop_ratio_data = await Event.raw(`
          select created_at, round(((value::json)->>'calculatedRatio')::decimal * 100, 2) as ratio from events
          where campaign_id = ${campaign.id}
          and name = 'ratio'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const callers_data = await Event.raw(`
          select created_at, (value::json)->>'callers' as callers from events
          where campaign_id = ${campaign.id}
          and name = 'calling'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const drop_data = await Event.raw(`
          select created_at, 1 as drops from events
          where campaign_id = ${campaign.id}
          and name = 'drop'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const calls_data = await Event.raw(`
          select date_trunc('minute', calls.created_at) as created_at, count(*) as value from calls
          inner join callees on callees.id = calls.callee_id
          where campaign_id = ${campaign.id}
          and calls.created_at > now() - '${time_period_in_hours} hours'::interval
          group by 1
          order by 1
          `)
      const completed_data = await Event.raw(`
          select events.created_at, 1 as value from events
          inner join callers on events.caller_id = callers.id and not callback
          where events.campaign_id = ${campaign.id}
          and events.name = 'caller_complete'
          and events.created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const tech_issue_data = await Event.raw(`
          select events.created_at, 1 as value from events
          inner join callers on events.caller_id = callers.id and not callback
          where events.campaign_id = ${campaign.id}
          and events.name = 'technical_issue_reported'
          and events.created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      Object.assign(data, { graph: {
        calls_in_progress: calls_in_progress.rows.map(event => { return {x: event.created_at, y: event.calls_in_progress} }),
        drop_data: drop_data.rows.map(event => { return {x: event.created_at, y: 0.5} }),
        callers_data: callers_data.rows.map(event => { return {x: event.created_at, y: parseFloat(event.callers)} }),
        completed_data: completed_data.rows.map(event => { return {x: event.created_at, y: 0} }),
        tech_issue_data: tech_issue_data.rows.map(event => { return {x: event.created_at, y: 1} }),
        calls_data: calls_data.rows.map(event => { return {x: event.created_at, y: event.value} }),
        ratio_data: ratio_data.rows.map(event => { return {x: event.created_at, y: parseFloat(event.ratio)} }),
        drop_ratio_data: drop_ratio_data.rows.map(event => { return {x: event.created_at, y: parseFloat(event.ratio)} })
      }});
    }
    const current_callers = data.available + data['callers_in_call'];
    data.approximate_rate = current_callers ? Math.round(total * 6 / current_callers) : 0;
    return data;
  }
  const data = await generateReport();
  return res.json({data: data})
}))

//teams report
app.get('/api/teams/:passcode/statistics', wrap(async (req, res, next) => {
  if (!req.params.passcode) return next(new BadRequestError('No Team Passcode Sent With Request'))
  const team = await Team.query().where({passcode: req.params.passcode}).first();
  if (!team) return next(new NotFoundError('No Team Exists With Passcode: ' + req.params.passcode))
  data = await knex.raw(
    `select c.created_at::date as date, cp.name, count(distinct ca.phone_number) as callers, count(c.id) as calls,
    sum(case when disposition !~* '(no answer|machine|meaningful)' then 1 else 0 end) as non_meaningful_conversations,
    sum(case when disposition ~* 'meaningful' then 1 else 0 end) as meaningful_conversations,
    sum(case when action !~* 'not' then 1 else 0 end) as actions,
    sum(case when loan_support ~* 'supports' then 1 else 0 end) as supports_loan,
    sum(case when loan_support ~* 'unsure' then 1 else 0 end) as unsure_of_support,
    sum(case when loan_support ~* 'does not support' then 1 else 0 end) as does_not_support
    from callees ce
    inner join calls c on c.callee_id = ce.id
    inner join campaigns cp on cp.id = ce.campaign_id
    left outer join callers ca on (c.caller_id = ca.id)
    left outer join (
    select * from crosstab(
    'select call_id::integer, question, answer from survey_results sr
    inner join calls c on c.id = sr.call_id::integer
    inner join callees ce on ce.id = c.callee_id
    inner join campaigns cp on cp.id = ce.campaign_id
    where  cp.name !~* ''test''',
    'select distinct question from survey_results sr
    inner join calls c on c.id = sr.call_id::integer
    inner join callees ce on ce.id = c.callee_id
    inner join campaigns cp on cp.id = ce.campaign_id
    where  cp.name !~* ''test'' order by question'
    ) as (call_id integer, action text, coalition_support text, disposition text, loan_support text, preferred_spending text, voter_id text)
    ) answers on answers.call_id = c.id
    where cp.name !~* 'test'
    and ca.team_id = ${team.id}
    group by 1,2
    order by date desc;`
  )
  return res.json({data: data.rows})
}))

//callees report
app.get('/api/callees/statistics', wrap(async (req, res, next) => {
  const period = req.params.period
  if (!period) {
    period_in_words = '99 years'
  } else if (period == 'hour') {
    period_in_words = '1 hours'
  } else if (period == 'day') {
    period_in_words = '1 days'
  } else {
    period_in_words = '1 weeks'
  }
  data = await knex.raw(`
    select
      calls_made.phone_number,
      (CASE WHEN calls_made.call_count is not null THEN calls_made.call_count::integer ELSE 0 END) as call_count,
      (CASE WHEN calling_sessions.calling_minutes is not null THEN calling_sessions.calling_minutes::integer ELSE 0 END) as calling_minutes,
      (CASE WHEN participation.campaign_participation is not null THEN participation.campaign_participation::integer ELSE 0 END) as participation,
      (CASE WHEN meaningful.survey_count is not null THEN meaningful.survey_count::integer ELSE 0 END) as meaningful,
      (CASE WHEN non_meaningful.survey_count is not null THEN non_meaningful.survey_count::integer ELSE 0 END) as non_meaningful,
      (CASE WHEN actions.action_count is not null THEN actions.action_count::integer ELSE 0 END) as actions,
      (CASE WHEN redirections.responsible_redirects is not null THEN redirections.responsible_redirects::integer ELSE 0 END) as redirects
    from (
      -- calls
      select callers.phone_number as phone_number, count(calls.id) as call_count
      from calls
      inner join callers on callers.id = calls.caller_id
      where callers.phone_number like '61%'
      and char_length(callers.phone_number) = 11
      and (calls.created_at > NOW() - INTERVAL '${period_in_words}')
      group by callers.phone_number
    ) calls_made
    left outer join (
      --minutes in calling sessions
      select readys.phone_number as phone_number, sum(EXTRACT(second FROM (call_endeds.created_at - readys.created_at)) / 60)::integer as calling_minutes
      from (
        select (CASE WHEN (body::json)->>'Direction' = 'inbound' THEN (body::json)->>'From' ELSE (body::json)->>'To' END) as phone_number, created_at, (body::json)->>'CallUUID' as call_uuid
        from logs
        where url ~* '/ready'
       ) readys
       inner join (
        select (CASE WHEN (body::json)->>'Direction' = 'inbound' THEN (body::json)->>'From' ELSE (body::json)->>'To' END) as phone_number, created_at, (body::json)->>'CallUUID' as call_uuid
        from logs
        where url ~* '/call_ended'
       ) call_endeds
       on call_endeds.call_uuid = readys.call_uuid
       group by readys.phone_number
    ) calling_sessions
    on calling_sessions.phone_number = calls_made.phone_number
    left outer join (
      --campagins participated in
      select phone_number, count(phone_number) as campaign_participation
      from (
        select (CASE WHEN (body::json)->>'Direction' = 'inbound' THEN (body::json)->>'From' ELSE (body::json)->>'To' END) as phone_number, SUBSTRING(url from '=([^&]+)') as campaign_id
        from logs
        where true
        and (CASE WHEN (body::json)->>'Direction' = 'inbound' THEN (body::json)->>'From' ELSE (body::json)->>'To' END) like '61%'
        and url ~* '/connect'
        group by campaign_id, phone_number
      ) campaign_participation
      group by phone_number
    ) participation
    on participation.phone_number = calls_made.phone_number
    left outer join (
      --meaningful surveys
      select callers.phone_number as phone_number, count(survey_results.id) as survey_count
      from calls
      inner join callers on callers.id = calls.caller_id
      inner join survey_results on survey_results.call_id = calls.id
      and survey_results.question = 'disposition'
      and survey_results.answer = 'meaningful conversation'
      group by callers.phone_number
    ) meaningful
    on meaningful.phone_number = calls_made.phone_number
    left outer join (
      --non meaningful surveys
      select callers.phone_number as phone_number, count(survey_results.id) as survey_count
      from calls
      inner join callers on callers.id = calls.caller_id
      inner join survey_results on survey_results.call_id = calls.id
      and survey_results.question = 'disposition'
      and survey_results.answer != 'meaningful conversation'
      group by callers.phone_number
    ) non_meaningful
    on non_meaningful.phone_number = calls_made.phone_number
    left outer join (
      --actioned surveys
      select callers.phone_number as phone_number, count(survey_results.id) as action_count
      from calls
      inner join callers on callers.id = calls.caller_id
      inner join survey_results on survey_results.call_id = calls.id
      and survey_results.question = 'action'
      and (survey_results.answer = 'will call member of parliament' or survey_results.answer = 'may call member of parliament')
      group by callers.phone_number
    ) actions
    on actions.phone_number = calls_made.phone_number
    left outer join (
      --redirects
      select callers.phone_number as phone_number, count(callers.phone_number) responsible_redirects
      from calls
      inner join callers on callers.id = calls.caller_id
      inner join callees on callees.id = calls.callee_id
      inner join redirects on redirects.phone_number = callees.phone_number
      group by callers.phone_number
    ) redirections
    on redirections.phone_number = calls_made.phone_number
    where calling_minutes > 1;
  `)
  return res.json({data: data.rows.map(event => { return event })})
}))

module.exports = app
