const app = require('express')();
const moment = require('moment');
const plivo = require('plivo');
const _ = require('lodash');
const api = require('../api');
const {withinDailyTimeOfOperation, dailyTimeOfOperationInWords} = require('../utils');
const dialer = require('../dialer');
const {
  sleep,
  extractCallerNumber,
  authenticationNeeded,
} = require('../utils');
const {Call, Callee, Caller, Campaign, SurveyResult, Event} = require('../models');

app.post('/connect', async ({body, query}, res) => {
  if (body.CallStatus === 'completed') return res.sendStatus(200);
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: (query.campaign_id || null)}).first();

  if (process.env.RECORD_CALLS === 'true') {
    r.addRecord({
      action: res.locals.appUrl('log'),
      maxLength: 60*60,
      recordSession: true,
      redirect: false
    });
  }

  if (!campaign){
    r.addWait({length: 2});
    r.addSpeakAU('An error has occurred. The number is not associated with a campaign');
    r.addWait({length: 1});
    r.addSpeakAU('GetUp technical staff have been notified. Hanging up now.');
    return res.send(r.toXML());
  }

  const callback = query.callback ? query.callback === "1" : false;
  const authenticated = query.authenticated ? query.authenticated === "1" : false;
  const promptAuth = authenticationNeeded(callback, query.entry, campaign.passcode, authenticated);
  const promptIntro = query.entry !== "more_info";

  if (campaign.status === "paused" || campaign.status === null){
    r.addWait({length: 2});
    r.addSpeakAU('Hi! Welcome to the GetUp Dialer tool.');
    r.addWait({length: 1});
    r.addSpeakAU('The campaign is currently paused! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  if (!withinDailyTimeOfOperation(campaign)) {
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the GetUp Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU(`The campaign is currently outside of it\'s daily times of operation! ${dailyTimeOfOperationInWords(campaign)} Thank you and have a great day!`);
    return res.send(r.toXML());
  }

  const callerNumber = extractCallerNumber(query, body);
  if (_.isEmpty(callerNumber)){
    r.addWait({length: 2});
    r.addSpeakAU('It appears you do not have caller id enabled. Please enable it and call back. Thank you.');
    return res.send(r.toXML());
  }

  const campaignComplete = await dialer.calledEveryone(campaign);
  if (campaignComplete || campaign.status == "inactive") {
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the GetUp Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU('The campaign has been completed! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  if (promptAuth) {
    r.addWait({length: 2});
    r.addSpeakAU('Please enter the campaign passcode on your keypad now.')
    const passcodeAction = r.addGetDigits({
      action: res.locals.appUrl(`passcode?campaign_id=${query.campaign_id}`),
      timeout: 10,
      retries: 10,
      numDigits: campaign.passcode.length
    });
    r.addRedirect(res.locals.appUrl('passcode'));
    return res.send(r.toXML());
  }

  let valid_digits = ['1', '2', '3', '4'];
  if(Object.keys(campaign.more_info).length > 0) {
    let more_info_digits = Object.keys(campaign.more_info);
    valid_digits = valid_digits.concat(more_info_digits);
  }

  const briefing = r.addGetDigits({
    action: res.locals.appUrl(`ready?campaign_id=${campaign.id}&caller_number=${callerNumber}&start=1&authenticated=${query.authenticated ? '1' : '0'}`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: valid_digits
  });

  briefing.addWait({length: 2});
  if (promptIntro) {
    if (query.callback) {
      briefing.addSpeakAU(`Hi! Welcome back.`);
    } else {
      briefing.addSpeakAU(`Hi! Welcome to the GetUp Dialer tool. Today you will be making calls for the ${campaign.name} campaign.`);
      briefing.addWait({length: 1});
      briefing.addSpeakAU('If you cannot afford long phone calls and would like to be called back instead, please press the 2 key');
    }
    briefing.addWait({length: 1});
    briefing.addSpeakAU('You should have a copy of the script and the disposition codes in front of you.');
    briefing.addWait({length: 1});
    briefing.addSpeakAU('If not, please press the 3 key');
    briefing.addWait({length: 1});
  }
  if (query.entry_key != "4") {
    briefing.addSpeakAU('For info on the dialing tool you are using, please press the 4 key');
    briefing.addWait({length: 1});
  }

  for (key in campaign.more_info) {
    if (query.entry_key != key) {
      let info_item = campaign.more_info[key];
      briefing.addSpeakAU('For info on '+ info_item.title +' please press the '+ key + 'key');
      briefing.addWait({length: 1});
    }
  }

  briefing.addSpeakAU('Otherwise, press 1 to get started!');
  briefing.addWait({length: 8});
  briefing.addSpeakAU('This message will automatically replay until you select a number on your phone\'s key pad.');
  res.send(r.toXML());
});

app.post('/ready', async ({body, query}, res) => {
  const r = plivo.Response();
  const authenticated = query.authenticated ? query.authenticated === "1" : false;
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  let caller_id;
  if (query.start) {
    if (body.Digits === '3') {
      r.addMessage(`Please print or download the script and disposition codes from ${_.escape(campaign.script_url)}. When you are ready, call again!`, {
        src: process.env.NUMBER || '1111111111', dst: query.caller_number
      });
      r.addSpeakAU('Sending an sms with instructions to your number. Thank you and speak soon!')
      return res.send(r.toXML());
    }
    const caller = await Caller.query().insert({phone_number: query.caller_number, call_uuid: body.CallUUID, campaign_id: query.campaign_id});
    caller_id = caller.id;
  } else {
    caller_id = query.caller_id;
  }
  const campaignComplete = await dialer.calledEveryone(campaign);
  if (campaignComplete) {
    r.addSpeakAU('The campaign has been completed!');
    r.addRedirect(res.locals.appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  if (body.Digits === '0') {
    r.addRedirect(res.locals.appUrl('disconnect'));
    return res.send(r.toXML());
  }

  if (body.Digits === '2') {
    await Caller.query().where({id: caller_id}).patch({callback: true});
    r.addSpeakAU('We will call you back immediately. Please hang up now!');
    return res.send(r.toXML());
  }

  if (body.Digits === '4') {
    r.addSpeakAU("Welcome to the Get Up dialer tool! This system works by dialing a number of people and patching them through to you when they pick up. Until they pick up, you'll hear music playing. When the music stops, that's your queue to start talking. Then you can attempt to have a conversation with them. At the end of the conversation, you'll be prompted to enter numbers into your phone to indicate the outcome of the call. It's important to remember that you never have to hang up your phone to end a call. If you need to end a call, just press star.");
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${campaign.id}&entry=more_info&entry_key=4&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  if(Object.keys(campaign.more_info).length > 0 && Object.keys(campaign.more_info).includes(body.Digits)) {
    r.addSpeakAU(campaign.more_info[body.Digits].content);
    r.addRedirect(res.locals.appUrl(`connect?campaign_id=${campaign.id}&entry=more_info&entry_key=${body.Digits}&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  r.addSpeakAU('You are now in the call queue.')
  let callbackUrl = `conference_event/caller?caller_id=${caller_id}&campaign_id=${query.campaign_id}`;
  if (query.start) {
    r.addSpeakAU('We will connect you to a call shortly.')
    r.addWait({length: 1});
    r.addSpeakAU('Remember, don\'t hangup *your* phone. Press star to end a call. Or wait for the other person to hang up.');
    callbackUrl += '&start=1';
  }

  let params = {
    waitSound: res.locals.appUrl('hold_music'),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: res.locals.appUrl(callbackUrl),
    hangupOnStar: 'true',
    action: res.locals.appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${query.campaign_id}`)
  }
  if (process.env.ENABLE_ANSWER_MACHINE_SHORTCUT) params.digitsMatch = ['2']
  r.addConference(`conference-${caller_id}`, params);
  res.send(r.toXML());
});

app.post('/hold_music', (req, res) => {
  const r = plivo.Response();
  _(1).range(7)
    .each(i => r.addPlay(`http://holdmusic.io/public/welcome-pack/welcome-pack-${i}.mp3`) )
  res.send(r.toXML());
});

app.post('/conference_event/caller', async ({query, body}, res) => {
  const conference_member_id = body.ConferenceMemberID;
  if (body.ConferenceAction === 'enter') {
    const caller = await Caller.query().where({id: query.caller_id})
      .patch({status: 'available', conference_member_id, updated_at: new Date()})
      .returning('*').first()
    let campaign = await Campaign.query().where({id: query.campaign_id}).first();
    const calls_in_progress = campaign.calls_in_progress;
    if (query.start) {
      await Event.query().insert({name: 'join', campaign_id: campaign.id, caller_id: caller.id, value: {calls_in_progress}})
    }else {
      await Event.query().insert({name: 'available', campaign_id: campaign.id, caller_id: caller.id, value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress}})
    }
  } else if (body.ConferenceAction === 'digits' && body.ConferenceDigitsMatch === '2') {
    const call = await Call.query().where({conference_uuid: body.ConferenceUUID}).first();
    if (call) {
      const params = {
        call_uuid: body.CallUUID,
        aleg_url: res.locals.appUrl(`survey_result?q=disposition&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}&digit=2`),
      }
      try {
        await api('transfer_call', params);
      } catch (e) {
        await Event.query().insert({campaign_id: query.campaign_id, name: 'failed_transfer', value: {call_id: call.id, error: e, call_uuid: body.CallUUID, conference_uuid: body.ConferenceUUID}});
      }
    }
  }
  res.sendStatus(200);
});

app.post('/survey', async ({query, body}, res) => {
  let call;
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const questions = campaign.questions;
  const question = query.q;
  const caller_id = query.caller_id;
  const questionData = questions[question];
  if (query.call_id) {
    call = await Call.query().where({id: query.call_id}).first();
  } else {
    call = await Call.query().where({conference_uuid: (body.ConferenceUUID || null)}).first();
  }
  if (!call) {
    r.addSpeakAU('You have left the call queue.')
    await Event.query().insert({campaign_id: query.campaign_id, name: 'left queue without call', value: body, caller_id})
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML());
  }
  if (call.status === 'machine_detected') {
    r.addSpeakAU('Answering machine detected.')
    r.addRedirect(res.locals.appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML());
  }
  const surveyResponse = r.addGetDigits({
    action: res.locals.appUrl(`survey_result?q=${question}&caller_id=${caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: Object.keys(questionData.answers),
  });
  if (question === 'disposition') {
    surveyResponse.addSpeakAU('The call has ended.');
  }
  surveyResponse.addSpeakAU(`${questionData.name}`);
  res.send(r.toXML());
});

app.post('/survey_result', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const questions = campaign.questions;
  const question = questions[query.q];
  const disposition = question.answers[body.Digits || query.digit].value;
  const next = question.answers[body.Digits || query.digit].next;

  r.addSpeakAU(disposition);

  const type = question.type;
  const deliver = question.answers[body.Digits || query.digit].deliver;
  if (type === 'SMS' && deliver) {
    const content = question.answers[body.Digits || query.digit].content;
    const call = await Call.query().where({id: query.call_id}).eager('callee').first();
    r.addMessage(`${content}`, {
      src: campaign.sms_number || process.env.NUMBER || '1111111111',
      dst: call.callee.phone_number
    });
  }

  const data = {
    log_id: res.locals.log_id,
    call_id: query.call_id,
    question: query.q,
    answer: disposition,
  }
  await SurveyResult.query().insert(data);

  if (next) {
    r.addRedirect(res.locals.appUrl(`survey?q=${next}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  } else {
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  }
  res.send(r.toXML());
});

app.post('/call_again', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  if (campaign.calls_in_progress === 0) {
    if (campaign.status === 'paused' || campaign.status === null) {
      r.addWait({length: 1});
      r.addSpeakAU('The campaign is currently paused! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
      return res.send(r.toXML());
    } else if (campaign.status === 'inactive') {
      r.addWait({length: 1});
      r.addSpeakAU('The campaign has been completed! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
      return res.send(r.toXML());
    }
  }
  const callAgain = r.addGetDigits({
    action: res.locals.appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`),
    timeout: 10,
    retries: 10,
    numDigits: 1,
    validDigits: ['1', '0']
  });
  callAgain.addSpeakAU('Press 1 to continue calling. To finish your calling session, press the zero key.');
  r.addRedirect(res.locals.appUrl('disconnect'));
  res.send(r.toXML());
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();

  r.addSpeakAU('Thank you very much for volunteering on this campaign.');

  const feedback = r.addGetDigits({
    action: res.locals.appUrl('feedback'),
    timeout: 5,
    retries: 2
  });
  feedback.addSpeakAU('To give feedback about your calling session, press 1. Otherwise, you can hang up - thanks again for calling. We hope to see you again soon!');

  res.send(r.toXML());
});

app.post('/feedback', (req, res) => {
  const r = plivo.Response();
  r.addSpeakAU('Please leave a short 30 second message after the beep. If you\'d like a response, be sure to leave your name and number.');
  r.addRecord({
    action: res.locals.appUrl('log'),
    maxLength: 60,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
});

app.post('/fallback', async ({body, query}, res) => {
  await Event.query().insert({campaign_id: query.campaign_id, name: 'caller fallback', value: body})
  const r = plivo.Response()
  r.addSpeakAU('Dreadfully sorry; an error has occurred. Please call back to continue.')
  res.send(r.toXML())
});

app.post('/call_ended', async ({body, query}, res) => {
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const caller = await Caller.query().where({call_uuid: body.CallUUID}).first();
  if (!caller) {
    await Event.query().insert({name: 'caller ended without entering queue', campaign_id: campaign.id, value: body});
    return res.sendStatus(200);
  }

  const seconds_waiting = caller.status === 'available' ? Math.round((new Date() - caller.updated_at) / 1000) : 0;
  const cumulative_seconds_waiting = caller.seconds_waiting + seconds_waiting;
  await caller.$query().patch({status: 'complete', seconds_waiting: cumulative_seconds_waiting});
  await Event.query().insert({name: 'caller_complete', campaign_id: campaign.id, caller_id: caller.id, value: {seconds_waiting, cumulative_seconds_waiting}})

  if (caller.callback) {
    const params = {
      from: campaign.phone_number || '1111111111',
      to: caller.phone_number,
      answer_url: res.locals.appUrl(`connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      hangup_url: res.locals.appUrl(`call_ended?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      ring_timeout: 120
    };
    try{
      await sleep(5000);
      await api('make_call', params);
    }catch(e){
      await Event.query().insert({name: 'failed_callback', campaign_id: campaign.id, caller_id: caller.id, value: {error: e}})
    }
  }
  return res.sendStatus(200);
});

app.post('/machine_detection', async ({body, query}, res) => {
  /*
  Message Drop implementation could go here and could potentially involve transferring the callee to a specified conference with a recording.
  */
  const aleg_url = res.locals.appUrl(`hangup?callee_id=${body.callee_id}&campaign_id=${query.campaign_id}`);
  const params = {
    call_uuid: body.CallUUID,
    legs: 'aleg',
    aleg_url : aleg_url
  };
  try{
    await api('transfer_call', params);
  }catch(e){
      await Event.query().insert({name: 'failed_post_machine_callee_transfer', campaign_id: query.campaign_id, value: {error: e}})
  }
  res.sendStatus(200);
});

module.exports = app;
