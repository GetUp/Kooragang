const plivo = require('plivo');
const promisfy = require('es6-promisify');
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});
const moment = require('moment');
const _ = require('lodash');

const {
  Call,
  Callee,
  Caller,
  Campaign,
  Event,
  transaction
} = require('./models');

module.exports.dial = async (...args) => {
  return args[1].dialer === 'ratio' ? ratioDial(...args) : powerDial(...args);
};

const ratioDial = async (appUrl, campaign) => {
  campaign = await recalculateRatio(campaign);
  const trans = await transaction.start(Callee.knex(), Caller.knex());
  const callers = await Caller.bindTransaction(trans).query().where({status: 'available'});
  const callsToMake = Math.floor(callers.length * campaign.ratio);
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const callees = await Callee.bindTransaction(trans).query()
    .whereRaw(`length(${cleanedNumber}) = 11`)
    .where({campaign_id: campaign.id})
    .whereNull('last_called_at')
    .orderBy('id')
    .limit(callsToMake);
  await Promise.all(callees.map(callee => updateAndCall(trans, campaign, callee, appUrl)))
  return trans.commit();
};

const recalculateRatio = async(campaign) => {
  const recalculationScheduledFor = moment().subtract(campaign.recalculate_ratio_window, 'seconds');
  let newRatio;
  const dropRatio = campaign.acceptable_drop_rate;
  if (campaign.last_checked_ratio_at && recalculationScheduledFor < campaign.last_checked_ratio_at) return campaign;
  const statusCounts = await Call.knexQuery().select('dropped')
    .innerJoin('callees', 'calls.callee_id', 'callees.id')
    .count('calls.id as count')
    .where('ended_at', '>=', moment().subtract(campaign.ratio_window, 'second').toDate())
    .where({campaign_id: campaign.id})
    .groupBy('dropped');
  const total = _.sumBy(statusCounts, ({count}) => parseInt(count, 10));
  const dropStatus = _.find(statusCounts, ({dropped}) => dropped);
  const drops = dropStatus ? parseInt(dropStatus.count, 10) : 0;
  if (drops / total > dropRatio) {
    newRatio = campaign.ratio - campaign.ratio_increment;
  }else {
    newRatio = campaign.ratio + campaign.ratio_increment;
  }
  if (newRatio < 1) newRatio = 1;
  if (newRatio > campaign.max_ratio) newRatio = campaign.max_ratio;
  if (process.env.NODE_ENV === 'development') console.error(`UPDATING RATIO TO ${newRatio}`)
  await Event.query().insert({campaign_id: campaign.id, name: 'ratio', value: newRatio});
  return await Campaign.query().patchAndFetchById(campaign.id, {ratio: newRatio, last_checked_ratio_at: new Date()});
}

const powerDial = async (appUrl, campaign) => {
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const calleeTransaction = await transaction.start(Callee.knex());
  const callee = await Callee.bindTransaction(calleeTransaction).query()
    .whereRaw(`length(${cleanedNumber}) = 11`)
    .whereNull('last_called_at')
    .where({campaign_id: campaign.id})
    .orderBy('id')
    .first();
  if (!callee) {
    if (process.env.NODE_ENV === 'development') console.error('NO MORE NUMBERS')
  }else{
    await updateAndCall(calleeTransaction, campaign, callee, appUrl);
  }
  return calleeTransaction.commit();
};

const updateAndCall = async (trans, campaign, callee, appUrl) => {
  await Callee.bindTransaction(trans).query()
    .patchAndFetchById(callee.id, {last_called_at: new Date})
  const params = {
    to: callee.phone_number,
    from : process.env.NUMBER || '1111111111',
    answer_url : `${appUrl}/answer?name=${callee.first_name}&callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    hangup_url : `${appUrl}/hangup?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    fallback_url : `${appUrl}/log?callee_id=${callee.id}&campaign_id=${callee.campaign_id}`,
    time_limit: 10 * 60,
    ring_timeout: 30
  };
  if (campaign.detect_answering_machine) {
    params.machine_detection = 'hangup';
    params.machine_detection_time = '3500';
  }
  if (process.env.NODE_ENV === 'development') console.error('CALLING', params)
  try{
    return await promisfy(api.make_call.bind(api))(params);
  }catch(e){
    console.error('======= Unable to make call:', params, ' and error: ', e);
  }
};

// TODO need a way to test if all calls have been processed and not just dialed.
// Potentially join against calls that are ended to make sure every callee has an ended call
module.exports.isComplete = async (campaign) => {
  const {count} = await Callee.knexQuery().count('id as count')
    .where({campaign_id: campaign.id})
    .whereNull('last_called_at').first();
  return parseInt(count, 10) === 0;
}

module.exports.notifyAgents = async () => {
  const callersInConference = await Caller.whereNotNull('status');
  if (process.env.NODE_ENV === 'development') console.error(`NOTIFYING ${callersInConference.length} CALLERS`)
  const notifications = callersInConference.map(async (caller) => {
    try{
      await promisfy(api.speak_conference_member.bind(api))({
        conference_id: caller.phone_number,
        member_id: caller.conference_member_id,
        text: 'Campaign ended. Press star to exit when ready',
        language: 'en-GB', voice: 'MAN'
      });
    }catch(e){};
  });
  return Promise.all(notifications);
}
