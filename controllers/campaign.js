const moment = require('moment');
const _ = require('lodash');
const {
  Call,
  Caller,
  Campaign,
  Event
} = require('../models');

exports.getStats = async ({body, params}, res) => {
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
    const data = {
      timestamp: moment().format('HH:mm:ss'),
      wait,
      total,
      drops,
      dropRate,
      available: getCountForStatus('available'),
      "in-call": getCountForStatus('in-call'),
      completed: getCountForStatus('complete')
    }
    const currentCallers = data.available + data['in-call'];
    data.rate = currentCallers ? Math.round(total*6 / currentCallers) : 0;
    return data;
  };
  const report = await generateReport();
  return res.render('stats.ejs', {campaign, report})
};
