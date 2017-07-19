const plivo = require('plivo');
const { plivo_api } = require('../api/plivo')
const moment = require('moment');
const _ = require('lodash');
const objection = require('objection')
const transaction = objection.transaction

const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event
} = require('../models');

module.exports.dial = async (appUrl, campaign) => {
  const timer = new Date();
  campaign = await recalculateRatio(campaign);
  const callers = await Caller.query().where({status: 'available', campaign_id: campaign.id});
  const callsToMake = Math.floor(callers.length * campaign.ratio);
  const callsToMakeExcludingCurrentCalls = callsToMake - campaign.calls_in_progress;
  const sortOrder = campaign.exhaust_callees_before_recycling ? 'call_attempts, last_called_at, id' : 'id';
  let callees = [];
  if (callsToMakeExcludingCurrentCalls > 0) {
    try{
      const callees_within_max_call_attempts = await Call.query()
        .groupByRaw(`
          1 having sum(case when status in ('busy', 'no-answer') then 1 else 0 end) < ${campaign.max_call_attempts}
          and sum(case when status not in ('busy', 'no-answer') then 1 else 0 end) = 0
        `)
        .select('callee_id');
      const trans = await transaction.start(Callee.knex());
      callees = await Callee.bindTransaction(trans).query()
        .forUpdate()
        .where({campaign_id: campaign.id})
        .whereRaw(`last_called_at < NOW() - INTERVAL '${campaign.no_call_window} minutes'`)
        .whereIn('id', callees_within_max_call_attempts)
        .orderByRaw(sortOrder)
        .limit(callsToMakeExcludingCurrentCalls);
      if (callees.length) {
        await Callee.bindTransaction(trans).query()
          .patch({last_called_at: new Date()})
          .increment('call_attempts')
          .whereIn('id', _.map(callees, (callee) => callee.id))
      }
      await trans.commit();
    } catch (e) {
      await trans.rollback();
      await Event.query().insert({campaign_id: campaign.id, name: 'callee_error', value: {error: e}});
    }
  }
  const updated_calls_in_progress = campaign.calls_in_progress + callees.length;
  if (callees.length) {
    await campaign.$query().increment('calls_in_progress', callees.length);
    await Promise.all(callees.map(callee => updateAndCall(campaign, callee, appUrl)))
    const value = {ratio: campaign.ratio, callers: callers.length, callsToMake, callees: callees.length, callsToMakeExcludingCurrentCalls, calls_in_progress: campaign.calls_in_progress, updated_calls_in_progress, time: new Date() - timer}
    await Event.query().insert({campaign_id: campaign.id, name: 'calling', value});
  }
};

const recalculateRatio = async(campaign) => {
  const recalculationScheduledFor = moment().subtract(campaign.recalculate_ratio_window, 'seconds');
  let newRatio, drops = 0, calculatedRatio = 0;
  const dropRatio = campaign.acceptable_drop_rate;
  if (campaign.last_checked_ratio_at && recalculationScheduledFor < campaign.last_checked_ratio_at) return campaign;
  const statusCounts = await Call.knexQuery().select('dropped')
    .innerJoin('callees', 'calls.callee_id', 'callees.id')
    .count('calls.id as count')
    .where('ended_at', '>=', moment().subtract(campaign.ratio_window, 'second').toDate())
    .where({campaign_id: campaign.id})
    .groupBy('dropped');
  const total = _.sumBy(statusCounts, ({count}) => parseInt(count, 10));
  if (total !== 0) {
    if (campaign.last_checked_ratio_at) {
      const callsInWindow = await Call.query()
        .innerJoin('callees', 'calls.callee_id', 'callees.id')
        .where('ended_at', '>', campaign.last_checked_ratio_at)
        .where({campaign_id: campaign.id}).limit(1)
      if (!callsInWindow.length) return campaign;
    }
    const dropRow = _.find(statusCounts, ({dropped}) => dropped);
    if (dropRow) drops = parseInt(dropRow.count, 10);
    calculatedRatio = drops / total;
    if (calculatedRatio > dropRatio) {
      newRatio = campaign.ratio - campaign.ratio_increment * campaign.ratio_decrease_factor;
    }else {
      newRatio = campaign.ratio + campaign.ratio_increment;
    }
    if (newRatio < 1) newRatio = 1;
    if (newRatio > campaign.max_ratio) newRatio = campaign.max_ratio;
  } else if (campaign.ratio !== 1){
    newRatio = 1;
  } else {
    return campaign;
  }
  await Event.query().insert({campaign_id: campaign.id, name: 'ratio', value: {ratio: newRatio.toPrecision(2), old_ratio: campaign.ratio, ratio_window: campaign.ratio_window, total, drops, calculatedRatio}});
  return Campaign.query().patchAndFetchById(campaign.id, {ratio: newRatio, last_checked_ratio_at: new Date()});
}

const updateAndCall = async (campaign, callee, appUrl) => {
  const params = {
    to: callee.phone_number,
    from : process.env.NUMBER || '1111111111',
    answer_url : `${appUrl}/answer?name=${callee.first_name || ''}&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    hangup_url : `${appUrl}/hangup?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    fallback_url : `${appUrl}/callee_fallback?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    time_limit: 30 * 60,
    ring_timeout: process.env.RING_TIMEOUT || 15
  };
  if (campaign.detect_answering_machine) {
    params.machine_detection = 'true';
    params.machine_detection_time = process.env.MACHINE_DETECTION_TIME || '3500';
    params.machine_detection_url = `${appUrl}/machine_detection?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`;
  }
  if (process.env.NODE_ENV === 'development') console.error('CALLING', params)
  try{
    await plivo_api('make_call', params);
  }catch(e){
    await decrementCallsInProgress(campaign);
    await Event.query().insert({campaign_id: campaign.id, name: 'api_error', value: {calls_in_progress: campaign.calls_in_progress, callee_id: callee.id, error: e}});
  }
};

const decrementCallsInProgress = async campaign => {
  const updatedCampaign = await Campaign.query()
    .returning('*')
    .where({id: campaign.id})
    .where('calls_in_progress', '>', 0)
    .decrement('calls_in_progress', 1)
    .first();
  return updatedCampaign || campaign;
}
module.exports.decrementCallsInProgress = decrementCallsInProgress;

module.exports.notifyAgents = async (campaign) => {
  const availableCallers = await Caller.query().where({status: 'available', campaign_id: campaign.id});
  for (let caller of availableCallers) {
    try{
      await plivo_api('speak_conference_member', {
        conference_id: `conference-${caller.id}`,
        member_id: caller.conference_member_id,
        text: 'Campaign ended. Press star to exit',
        language: 'en-GB', voice: 'MAN'
      });
    }catch(e){};
  }
}
