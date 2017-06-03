const app = require('express')()
const env = process.env.NODE_ENV || 'development';
const config = require('../knexfile');   
const knex = require('knex')(config[env]);
const { Campaign, Call, Caller, Callee, Event, Team } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")

//campaign report
app.get('/api/campaigns/:id/report', wrap(async (req, res, next) => {
  const graph = !!req.query.graph;
  const campaign = await Campaign.query().where({id: req.params.id}).first();
  if (!campaign) return next(new NotFoundError('No Campagin Exists With ID: ' + req.params.id))
  const generateReport = async () => {
    let validationErrors;
    try{
      campaign.valid()
    } catch(e) {
      validationErrors = _.map(e.data.questions, 'message').join(' and ');
    };
    const callerCounts = await Caller.knexQuery().select('status')
      .count('callers.id as count')
      .whereRaw("created_at >= NOW() - INTERVAL '60 minutes'")
      .where({campaign_id: campaign.id})
      .groupBy('status');
    const statusCounts = await Call.knexQuery().select('dropped')
      .innerJoin('callees', 'calls.callee_id', 'callees.id')
      .count('calls.id as count')
      .whereRaw("ended_at >= NOW() - INTERVAL '10 minutes'")
      .where({campaign_id: campaign.id})
      .groupBy('dropped');
    const techIssues = await Event.query()
      .count('events.id as count')
      .where({campaign_id: campaign.id, name: 'technical_issue_reported'});
    const techIssueCount = _.sumBy(techIssues, ({count}) => parseInt(count, 10));
    const waitEvents = await Event.query()
      .whereIn('name', ['caller_complete', 'answered'])
      .where({campaign_id: campaign.id})
      .whereRaw("created_at >= NOW() - INTERVAL '10 minutes'");
    const wait = waitEvents.length ? Math.round(_.sumBy(waitEvents, event => JSON.parse(event.value).seconds_waiting) / waitEvents.length) : 0;
    const total = _.sumBy(statusCounts, ({count}) => parseInt(count, 10));
    const dropStatus = _.find(statusCounts, ({dropped}) => dropped);
    const drops = dropStatus ? parseInt(dropStatus.count, 10) : 0;
    const dropRate = total ? Math.round(drops*100/total) : 0;
    const getCountForStatus = (status) => {
      const record = _.find(callerCounts, (record) => record.status === status);
      return record ? parseInt(record.count, 10) : 0;
    }
    const data = {
      timestamp: moment().format('HH:mm:ss'),
      wait,
      total,
      drops,
      dropRate,
      available: getCountForStatus('available'),
      "in-call": getCountForStatus('in-call'),
      completed: getCountForStatus('complete'),
      techIssueCount,
      validationErrors
    };
    if (graph) {
      const time_period_in_hours = 24;
      const calls_in_progress = await Event.raw(`
          select created_at, ((value::json)->>'calls_in_progress')::integer as calls_in_progress from events
          where campaign_id = ${campaign.id}
          and (value::json)->'calls_in_progress' is not null
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const ratioData = await Event.raw(`
          select created_at, (value::json)->>'ratio' as ratio from events
          where campaign_id = ${campaign.id}
          and name = 'ratio'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const dropRatioData = await Event.raw(`
          select created_at, round(((value::json)->>'calculatedRatio')::decimal * 100, 2) as ratio from events
          where campaign_id = ${campaign.id}
          and name = 'ratio'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const callersData = await Event.raw(`
          select created_at, (value::json)->>'callers' as callers from events
          where campaign_id = ${campaign.id}
          and name = 'calling'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const dropData = await Event.raw(`
          select created_at, 1 as drops from events
          where campaign_id = ${campaign.id}
          and name = 'drop'
          and created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const callsData = await Event.raw(`
          select date_trunc('minute', calls.created_at) as created_at, count(*) as value from calls
          inner join callees on callees.id = calls.callee_id
          where campaign_id = ${campaign.id}
          and calls.created_at > now() - '${time_period_in_hours} hours'::interval
          group by 1
          order by 1
          `)
      const completedData = await Event.raw(`
          select events.created_at, 1 as value from events
          inner join callers on events.caller_id = callers.id and not callback
          where events.campaign_id = ${campaign.id}
          and events.name = 'caller_complete'
          and events.created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      const techIssueData = await Event.raw(`
          select events.created_at, 1 as value from events
          inner join callers on events.caller_id = callers.id and not callback
          where events.campaign_id = ${campaign.id}
          and events.name = 'technical_issue_reported'
          and events.created_at > now() - '${time_period_in_hours} hours'::interval
          order by 1
          `)
      Object.assign(data, {
        calls_in_progress: calls_in_progress.rows.map(event => { return {x: event.created_at, y: event.calls_in_progress} }),
        dropData: dropData.rows.map(event => { return {x: event.created_at, y: 0.5} }),
        callersData: callersData.rows.map(event => { return {x: event.created_at, y: parseFloat(event.callers)} }),
        completedData: completedData.rows.map(event => { return {x: event.created_at, y: 0} }),
        techIssueData: techIssueData.rows.map(event => { return {x: event.created_at, y: 1} }),
        callsData: callsData.rows.map(event => { return {x: event.created_at, y: event.value} }),
        ratioData: ratioData.rows.map(event => { return {x: event.created_at, y: parseFloat(event.ratio)} }),
        dropRatioData: dropRatioData.rows.map(event => { return {x: event.created_at, y: parseFloat(event.ratio)} })
      });
    }
    const currentCallers = data.available + data['in-call'];
    data.rate = currentCallers ? Math.round(total*6 / currentCallers) : 0;
    return res.json({data: data})
  }
}))

//teams report
app.get('/api/teams/:passcode/report', wrap(async (req, res, next) => {
  if (!req.params.passcode) return next(new BadRequestError('No Team Passcode Sent With Request'))
  const team = await Team.query().where({passcode: req.params.passcode}).first();
  if (!team) return next(new NotFoundError('No Team Exists With Passcode: ' + req.params.passcode))
  try {
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
    );
    return res.json({data: data})
  } catch (e) {
    return next(new BadRequestError("Insufficent Data For Team : " + team.name))
  }
}))

module.exports = app
