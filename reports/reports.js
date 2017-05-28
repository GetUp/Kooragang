const app = require('express')();
const moment = require('moment');
const _ = require('lodash');
const {Call, Callee, Caller, Campaign, Event} = require('../models');

const getCalleeStatus = async (campaignId) => {
    const callee_status = await Event.raw(`
SELECT 
  outcomes.outcome,
  calls_received.calls_received,
  COUNT(*) as count
FROM
(
  SELECT
    callees.id as callee_id,
    CASE WHEN sr.answer is not null THEN sr.answer
      ELSE (CASE WHEN calls.status is not null THEN calls.status END) 
    END as outcome
  FROM callees 
  LEFT JOIN calls 
    ON (calls.callee_id = callees.id AND calls.created_at = (SELECT MAX(created_at) FROM calls c WHERE c.callee_id = callees.id) )
  LEFT JOIN survey_results sr 
    ON (sr.call_id::integer = calls.id AND sr.question = 'disposition')
  WHERE callees.campaign_id = ${campaignId}
) outcomes
JOIN 
(
  SELECT 
    callees.id as callee_id,
    COUNT(calls.id) as calls_received
  FROM callees  
  LEFT JOIN calls
    ON calls.callee_id = callees.id
  WHERE callees.campaign_id = ${campaignId}
  GROUP BY callees.id
) calls_received
  ON outcomes.callee_id = calls_received.callee_id
GROUP BY calls_received.calls_received, outcomes.outcome     
      `)
  const data = callee_status.rows.map(row => {
    var status;
    if (row.outcome == 'do not call'){
      status = "D. Don't call"
    } else if (['completed', 'busy', 'undecided', 'answering machine', 'no-answer', 'failed'].indexOf(row.outcome) > -1) {
      if (row.calls_received >= 3){
        status = "D. Don't call"
      } else {
        status = "B. Call again"
      }
    } else if (row.calls_received == 0){
      status = "C. Not called"
    } else {
      status = "A. Calling complete"
    }
    return {status: status, count: Number(row.count)};
  })

  console.log(data)

  var result = _(data)
    .orderBy('status')
    .groupBy('status')
    .map((v, k) => ([ 
        k,
        _.sumBy(v, 'count')
    ])).value();

  return result
}

const getCalleeDispositions = async (campaignId) => {
  const dispositions = await Event.raw(`
SELECT
  sr.answer, COUNT(*) as count
FROM callees 
JOIN calls 
  ON (calls.callee_id = callees.id AND calls.created_at = (SELECT MAX(created_at) FROM calls c WHERE c.callee_id = callees.id) )
JOIN survey_results sr 
  ON (sr.call_id::integer = calls.id AND sr.question = 'disposition')
  WHERE callees.campaign_id = ${campaignId}
GROUP BY sr.answer
ORDER BY count DESC
  `)

  const data = dispositions.rows.map(row => {
    return [row.answer, Number(row.count)]
  })

  return data
}

const getLiveCalls = async (campaignId) => {
  const live_calls = await Event.raw(`
SELECT callees.phone_number as callee_phone, callers.phone_number as caller_phone, calls.connected_at, calls.status, calls.dropped
FROM calls
JOIN callees
  ON callees.id = calls.callee_id
LEFT JOIN callers
  ON callers.id = calls.caller_id
WHERE (calls.ended_at is null OR calls.ended_at > current_timestamp - INTERVAL '60 SECOND')
  AND callees.campaign_id = ${campaignId}
ORDER BY calls.updated_at DESC
  `)

  return live_calls.rows
}

module.exports = {
  getCalleeStatus: getCalleeStatus,
  getCalleeDispositions: getCalleeDispositions,
  getLiveCalls: getLiveCalls
}