const app = require('express')();
const plivo = require('plivo');
const _ = require('lodash');
const dialer = require('../dialer');
const plivo_api = require('../api/plivo');
const {Call, Callee, Caller, Campaign, Event, transaction} = require('../models');

app.post('/answer', async ({body, query}, res) => {
  const r = plivo.Response();
  const name = query.name;
  let errorFindingCaller, caller, seconds_waiting;

  const callerTransaction = await transaction.start(Caller.knex());
  try{
    caller = await Caller.bindTransaction(callerTransaction).query().forUpdate()
      .where({status: 'available', campaign_id: query.campaign_id}).orderBy('updated_at').limit(1).first();
    if (caller) {
      seconds_waiting = Math.round((new Date() - caller.updated_at) / 1000);
      await caller.$query().patch({status: 'in-call', seconds_waiting: caller.seconds_waiting + seconds_waiting})
    }
    await callerTransaction.commit()
  } catch (e) {
    await callerTransaction.rollback();
    errorFindingCaller = e;
  }

  let campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const calls_in_progress = campaign.calls_in_progress;
  campaign = await dialer.decrementCallsInProgress(campaign);

  if (!errorFindingCaller && caller) {
    const call = await Call.query().insert({
      log_id: res.locals.log_id,
      caller_id: caller.id,
      callee_id: query.callee_id,
      status: 'answered',
      callee_call_uuid: body.CallUUID
    });
    if (!_.isEmpty(name)) {
      const params = {
        conference_id: `conference-${caller.id}`,
        member_id: caller.conference_member_id,
        text: name,
        language: 'en-GB', voice: 'MAN'
      }
      try{
        if (process.env.SPEAK_NAMES) await plivo_api('speak_conference_member', params);
      }catch(e){
        await Event.query().insert({name: 'failed_speak_name', campaign_id: campaign.id, call_id: call.id, caller_id: caller.id, value: {error: e} })
      }
    }

    await Event.query().insert({name: 'answered', campaign_id: campaign.id, call_id: call.id, caller_id: caller.id, value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress, seconds_waiting} })
    r.addConference(`conference-${caller.id}`, {
      startConferenceOnEnter: false,
      stayAlone: false,
      callbackUrl: res.locals.appUrl(`conference_event/callee?caller_id=${caller.id}&campaign_id=${query.campaign_id}`)
    });
  } else {
    const call = await Call.query().insert({
      log_id: res.locals.log_id,
      callee_id: query.callee_id,
      status: 'dropped',
      dropped: true,
      callee_call_uuid: body.CallUUID
    });
    const status = errorFindingCaller ? 'drop from error' : 'drop';
    await Event.query().insert({campaign_id: campaign.id, call_id: call.id, name: status, value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress, errorFindingCaller} })
    r.addHangup({reason: 'drop'});
  }
  res.send(r.toXML());
});

app.post('/hangup', async ({body, query}, res) => {
  let call = await Call.query().where({callee_call_uuid: body.CallUUID}).first();
  const status = body.Machine === 'true' ? 'machine_detection' : body.CallStatus;
  if (call){
    await Call.query().where({callee_call_uuid: body.CallUUID})
      .patch({ended_at: new Date(), status, duration: body.Duration});
  }else{
    call = await Call.query().insert({
      callee_call_uuid: body.CallUUID, callee_id: query.callee_id,
      ended_at: new Date(),
      status, duration: body.Duration
    });
    let {campaign} = await Callee.query().eager('campaign').where({id: call.callee_id}).first();
    const calls_in_progress = campaign.calls_in_progress;
    campaign = await dialer.decrementCallsInProgress(campaign);
    await Event.query().insert({name: 'filter', campaign_id: campaign.id, call_id: call.id, value: {status, calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress}})
  }
  res.sendStatus(200);
});


app.post('/conference_event/callee', async ({query, body}, res) => {
  if (body.ConferenceAction === 'enter'){
    const call = await Call.query().where({callee_call_uuid: body.CallUUID}).first();
    const data = {
      conference_uuid: body.ConferenceUUID,
      connected_at: new Date()
    }
    if (call.status !== 'machine_detection') { data.status = 'connected' }
    await call.$query().patch(data);
  }
  res.sendStatus(200);
});

app.post('/callee_fallback', async ({body, query}, res) => {
  await Event.query().insert({campaign_id: query.campaign_id, name: 'callee fallback', value: {body, query}})
  const r = plivo.Response()
  r.addHangup()
  res.send(r.toXML())
});

module.exports = app;
