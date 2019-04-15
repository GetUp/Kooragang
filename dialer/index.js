const { plivo_api } = require('../api/plivo')
const moment = require('moment');
const _ = require('lodash');
const objection = require('objection')
const transaction = objection.transaction
const removeDiacritics = require('diacritics').remove
const { sipFormatNumber, languageBlock } = require('../utils')
const voice = require('../ivr/voice')

const {
  QueuedCall,
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
  const incall = await Caller.query().where({status: 'in-call', campaign_id: campaign.id})
  const callsToMake = Math.floor(callers.length * campaign.ratio);
  const queued_calls = parseInt((await QueuedCall.query().where({campaign_id: campaign.id}).whereRaw("created_at > now() - '15 minutes'::interval").count('id'))[0].count, 10)
  const callsToMakeExcludingCurrentCalls = callsToMake - queued_calls;
  let callees = [];
  let trans
  if (callsToMakeExcludingCurrentCalls > 0) {
    try{
      const callees_callable_ids = campaign.callableCallees(callsToMakeExcludingCurrentCalls)
      trans = await transaction.start(Callee.knex())
      callees = await Callee.bindTransaction(trans).query()
        .forUpdate()
        .whereIn('id', callees_callable_ids)
      if (callees.length) {
        await Callee.bindTransaction(trans).query()
          .patch({last_called_at: new Date()})
          .whereIn('id', _.map(callees, 'id'))
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
    const callee_ids = _.map(callees, 'id')
    const value = {ratio: campaign.ratio, incall: incall.length, callers: callers.length, callsToMake, callees: callees.length, callee_ids, callsToMakeExcludingCurrentCalls, calls_in_progress: campaign.calls_in_progress, updated_calls_in_progress, time: new Date() - timer, queued_calls}
    await Event.query().insert({campaign_id: campaign.id, name: 'calling', value});
  } else if (campaign.log_no_calls && callers.length) {
    const value = {ratio: campaign.ratio, incall: incall.length, callers: callers.length, calls_in_progress: campaign.calls_in_progress, time: new Date() - timer, queued_calls}
    await Event.query().insert({campaign_id: campaign.id, name: 'no-calling', value});
  }
};

const recalculateRatio = async (campaign) => {
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
  const callers = await Caller.knexQuery().where({campaign_id: campaign.id}).whereIn('status', ['available', 'in-call']).count().first();
  if (total !== 0 && callers.count >= campaign.min_callers_for_ratio) {
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

const formattedName = (callee) => removeDiacritics(callee.first_name  || '') .replace(/[^a-zA-Z]/g,'-')

module.exports.callerCallParams = (campaign, phone_number, appUrl, assessment=0) => {
  return {
    to: phone_number,
    from: campaign.phone_number || '1111111111',
    answer_url: `${appUrl}/connect?campaign_id=${campaign.id}&number=${phone_number}&assessment=${assessment}`,
    hangup_url: `${appUrl}/call_ended?campaign_id=${campaign.id}&number=${phone_number}&assessment=${assessment}`,
    ring_timeout: 30
  }
}

const calleeCallParams = (campaign, callee, appUrl) => {
  return {
    to: sipFormatNumber(callee.phone_number),
    from : campaign.outgoing_number || process.env.NUMBER || '1111111111',
    answer_url : `${appUrl}/answer?name=${formattedName(callee)}&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    hangup_url : `${appUrl}/hangup?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    fallback_url : `${appUrl}/callee_fallback?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    time_limit: 40 * 60,
    ring_timeout: campaign.ring_timeout || process.env.RING_TIMEOUT || 15
  }
}

const updateAndCall = async (campaign, callee, appUrl) => {
  const params = calleeCallParams(campaign, callee, appUrl)
  if (process.env.SIP_HEADERS && params.to.match(/^sip:/)) params.sip_headers = process.env.SIP_HEADERS
  if (campaign.detect_answering_machine) {
    params.machine_detection = 'true';
    params.machine_detection_time = process.env.MACHINE_DETECTION_TIME || '3500';
    params.machine_detection_url = `${appUrl}/machine_detection?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`;
  }
  if (process.env.NODE_ENV === 'development') console.error('CALLING', params)
  try{
    const [status, response] = await plivo_api('make_call', params, {multiArgs: true});
    await QueuedCall.query().insert({callee_id: callee.id, campaign_id: callee.campaign_id, response, status})
    await Event.query().insert({name: 'call_initiated', campaign_id: callee.campaign_id, value: {callee_id: callee.id, status, response}})
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
      await plivo_api('speak_conference_member', _.extend({
        conference_id: `conference-${caller.id}`,
        member_id: caller.conference_member_id,
        text: languageBlock('notify_agents_campaign_ended')
      }, voice()));
    }catch(e){}
  }
}
