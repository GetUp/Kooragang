const app = require('express')();
const moment = require('moment');
const _ = require('lodash');
const {Call, Callee, Caller, Campaign, Event} = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.get('/stats/:id', async ({body, params}, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: params.id}).first();
  if (!campaign) res.sendStatus(404);
  const generateReport = async () => {
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
        select created_at, 1 as value from events
        where campaign_id = ${campaign.id}
        and name = 'caller_complete'
        and created_at > now() - '${time_period_in_hours} hours'::interval
        and ((value::json)->>'cumulative_seconds_waiting')::integer > 0
        order by 1
        `)
    const data = {
      timestamp: moment().format('HH:mm:ss'),
      wait,
      total,
      drops,
      dropRate,
      available: getCountForStatus('available'),
      "in-call": getCountForStatus('in-call'),
      completed: getCountForStatus('complete'),
      calls_in_progress: calls_in_progress.rows.map(event => { return {x: event.created_at, y: event.calls_in_progress} }),
      dropData: dropData.rows.map(event => { return {x: event.created_at, y: 0.5} }),
      callersData: callersData.rows.map(event => { return {x: event.created_at, y: parseFloat(event.callers)} }),
      completedData: completedData.rows.map(event => { return {x: event.created_at, y: 0} }),
      callsData: callsData.rows.map(event => { return {x: event.created_at, y: event.value} }),
      ratioData: ratioData.rows.map(event => { return {x: event.created_at, y: parseFloat(event.ratio)} })
    }
    const currentCallers = data.available + data['in-call'];
    data.rate = currentCallers ? Math.round(total*6 / currentCallers) : 0;
    return data;
  };
  const report = await generateReport();
  return res.render('stats.ejs', {campaign, report})
});

module.exports = app;
