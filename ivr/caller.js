const app = require('express')();
const moment = require('moment');
const plivo = require('plivo');
const _ = require('lodash');
const { plivo_api } = require('../api/plivo');
const dialer = require('../dialer');
const {
  sleep,
  extractCallerNumber,
  authenticationNeeded,
  isValidCallerNumber
} = require('../utils');
const {Call, Callee, Caller, Campaign, SurveyResult, Event, User, Team} = require('../models');

app.post('/connect', async ({body, query}, res) => {
  if (body.CallStatus === 'completed') return res.sendStatus(200);
  const r = plivo.Response();
  const campaign = query.campaign_id && await Campaign.query().where({id: query.campaign_id}).first();

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
    r.addSpeakAU(`${process.env.ORG_NAME || ""} technical staff have been notified. Hanging up now.`);
    return res.send(r.toXML());
  }

  const callback = query.callback ? query.callback === "1" : false;
  const authenticated = query.authenticated ? query.authenticated === "1" : false;
  const promptAuth = authenticationNeeded(callback, campaign.passcode, authenticated);

  if (campaign.isPaused()){
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the ${process.env.ORG_NAME || ""} Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU('The campaign is currently paused! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  if (!campaign.isWithinDailyTimeOfOperation()) {
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the ${process.env.ORG_NAME || ""} Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU(`The campaign is currently outside of it\'s hours of operation! ${campaign.dailyTimeOfOperationInWords()} Thank you and have a great day!`);
    return res.send(r.toXML());
  }

  const caller_number = extractCallerNumber(query, body);
  if (!isValidCallerNumber(caller_number)){
    r.addWait({length: 2});
    r.addSpeakAU('It appears you do not have caller ID enabled. Please enable it and call back. Don\'t worry, even when your caller ID is enabled the people you\'re talking to do not see your number. Thank you.');
    return res.send(r.toXML());
  }

  if (await campaign.isComplete()) {
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the ${process.env.ORG_NAME || ""} Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU('The campaign has been completed! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  if (promptAuth) {
    r.addWait({length: 2});
    const passcodeAction = r.addGetDigits({
      action: res.locals.appUrl(`passcode?campaign_id=${query.campaign_id}`),
      timeout: 10,
      retries: 10,
      numDigits: campaign.passcode.length
    });
    passcodeAction.addSpeakAU('Please enter the campaign passcode on your keypad now.')
    r.addRedirect(res.locals.appUrl('passcode'));
    return res.send(r.toXML());
  }

  if (campaign.teams && !query.team && !query.callback) {
    r.addWait({length: 2})
    const user = await User.query().where({phone_number: body.From}).first()
    let valid_team_digits = ['2', '*']
    if (user && user.team_id) { valid_team_digits.push('1') }
    const teamAction = r.addGetDigits({
      action: res.locals.appUrl(`team?campaign_id=${query.campaign_id}&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}`),
      timeout: 10,
      retries: 10,
      numDigits: 1,
      validDigits: valid_team_digits
    })
    if (user && user.team_id) {
      const team = await Team.query().where({id: user.team_id}).first()
      teamAction.addSpeakAU(`Press the one key to resume your membership to the ${team.name} calling team`)
      teamAction.addWait({length: 1})
      teamAction.addSpeakAU('Press the two key if you\'re joining a new team.')
    } else {
      teamAction.addSpeakAU('Press the two key on your keypad if you\'re a member of a calling team.')
    }
    teamAction.addSpeakAU('Otherwise to continue without a team press the star key.')
    r.addSpeakAU('No key pressed. Hanging up now')
    return res.send(r.toXML())
  }

  r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller_number}&start=1&callback=${query.callback ? query.callback : 0}&authenticated=${query.authenticated ? '1' : '0'}`));
  res.send(r.toXML())
});

app.post('/briefing', async ({body, query}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: (query.campaign_id || "")}).first();
  let valid_briefing_digits = ['1', '2', '3', '4'];

  if(Object.keys(campaign.more_info).length > 0) {
    let more_info_digits = Object.keys(campaign.more_info);
    valid_briefing_digits = valid_briefing_digits.concat(more_info_digits);
  }

  const briefing = r.addGetDigits({
    action: res.locals.appUrl(`ready?campaign_id=${campaign.id}&caller_number=${query.caller_number}&caller_id=${query.caller_id}&start=1&authenticated=${query.authenticated ? '1' : '0'}`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: valid_briefing_digits
  });

  briefing.addWait({length: 2});
  if (query.entry !== 'more_info') {
    if (query.callback === '1') {
      briefing.addSpeakAU(`Hi! Welcome back.`);
    } else {
      briefing.addSpeakAU(`Hi! Welcome to the ${process.env.ORG_NAME || ""} Dialer tool. Today you will be making calls for the ${campaign.name} campaign.`);
      briefing.addWait({length: 1});
      briefing.addSpeakAU('If you cannot afford long phone calls and would like to be called back instead, please press the 2 key');
    }
  }
  briefing.addWait({length: 1});
  briefing.addSpeakAU('You should have a copy of the script and the disposition codes in front of you.');
  briefing.addWait({length: 1});
  briefing.addSpeakAU('If not, please press the 3 key');
  briefing.addWait({length: 1});

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
  let caller_id, caller;
  if (query.start) {
    if (body.Digits === '3') {
      r.addMessage(`Please print or download the script and disposition codes from ${_.escape(campaign.script_url)}. When you are ready, call again!`, {
        src: process.env.NUMBER || '1111111111', dst: query.caller_number
      });
      r.addSpeakAU('Sending an sms with instructions to your number. Thank you and speak soon!')
      return res.send(r.toXML());
    }
  }
  if (query.start && !query.caller_id) {
    caller_params = {
      phone_number: query.caller_number,
      call_uuid: body.CallUUID,
      campaign_id: query.campaign_id
    }
    if (body.From) {
      const user = await User.query().where({phone_number: body.From}).first();
      if (user && user.team_id) {
        caller_params.team_id = user.team_id
      }
    }
    caller = await Caller.query().insert(caller_params);
    caller_id = caller.id;
  } else {
    caller_id = query.caller_id;
  }
  if (await campaign.isComplete()) {
    r.addSpeakAU('The campaign has been completed!');
    r.addRedirect(res.locals.appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  if (body.Digits === '8' && query.call_id) {
    await Event.query().insert({name: 'undo', campaign_id: campaign.id, caller_id, call_id: query.call_id, value: {log_id: query.log_id}})
    await SurveyResult.query().where({call_id: query.call_id}).delete();
    r.addRedirect(res.locals.appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${campaign.id}&undo=1&call_id=${query.call_id}`))
    return res.send(r.toXML());
  } else if (body.Digits === '9' && query.call_id) {
    await Event.query().insert({name: 'technical_issue_reported', campaign_id: campaign.id, caller_id, call_id: query.call_id, value: {query: query, body: body}})
    r.addSpeakAU('The technical issue has been reported. The team will investigate. Thank you!')
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}&tech_issue_reported=1&call_id=${query.call_id}`));
    return res.send(r.toXML());
  } else if (body.Digits === '0') {
    r.addRedirect(res.locals.appUrl('disconnect'));
    return res.send(r.toXML());
  } else if (body.Digits === '2') {
    await Caller.query().where({id: caller_id}).patch({callback: true});
    r.addSpeakAU('We will call you back immediately. Please hang up now!');
    return res.send(r.toXML());
  } else if (body.Digits === '4') {
    r.addSpeakAU("Welcome to the Get Up dialer tool! This system works by dialing a number of people and patching them through to you when they pick up. Until they pick up, you'll hear music playing. When the music stops, that's your queue to start talking. Then you can attempt to have a conversation with them. At the end of the conversation, you'll be prompted to enter numbers into your phone to indicate the outcome of the call. It's important to remember that you never have to hang up your phone to end a call. If you need to end a call, just press star.");
    r.addRedirect(res.locals.appUrl(`briefing?caller_id=${caller_id}&campaign_id=${campaign.id}&entry=more_info&entry_key=4&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  if(Object.keys(campaign.more_info).length > 0 && Object.keys(campaign.more_info).includes(body.Digits)) {
    r.addSpeakAU(campaign.more_info[body.Digits].content);
    r.addRedirect(res.locals.appUrl(`briefing?caller_id=${caller_id}&campaign_id=${campaign.id}&entry=more_info&entry_key=${body.Digits}&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  if (query.start && !process.env.DISABLE_CALL_RESUME) {
    const last_caller = await Caller.query()
      .where({campaign_id: campaign.id, phone_number: caller.phone_number})
      .whereNot({id: caller.id})
      .orderBy('updated_at', 'desc')
      .limit(1).first();
    const last_call = last_caller && await Call.query().where({caller_id: last_caller.id})
      .whereRaw("calls.created_at > now() - '30 minutes'::interval")
      .eager('survey_results')
      .orderBy('created_at', 'desc')
      .limit(1).first();
    if (last_call && !last_call.survey_results.length) {
      const resumeIVR = r.addGetDigits({
        action: res.locals.appUrl(`resume_survey?caller_id=${caller_id}&last_call_id=${last_call.id}&campaign_id=${query.campaign_id}`),
        redirect: true,
        retries: 10,
        numDigits: 1,
        timeout: 10,
        validDigits: [1, 2],
      });
      resumeIVR.addSpeakAU('It appears your last call ended before you could record the overall outcome.')
      resumeIVR.addSpeakAU('Press 1 to enter the overall outcome for your last call. Otherwise, press 2 to continue.')
      return res.send(r.toXML());
    }
  }

  if ((query.start || query.resumed) && campaign.hud) {
    const code = caller_id.toString().split('').join(' ');
    r.addSpeakAU(`If you are using a computer to preview the callees details, your session code is ${code}. I repeat ${code}`)
    const sessionCodePause = r.addGetDigits({
      retries: 4,
      numDigits: 1,
      timeout: 30,
      validDigits: [1],
    })
    sessionCodePause.addSpeakAU('Press 1 when you are ready to continue')
  }

  if (query.start || body.Digits === '1') {
    r.addSpeakAU('You are now in the call queue.')
  } else {
    r.addSpeakAU('You have been placed back in the call queue.')
  }

  let callbackUrl = `conference_event/caller?caller_id=${caller_id}&campaign_id=${query.campaign_id}`;
  if (query.start) {
    r.addSpeakAU('We will connect you to a call shortly.')
    r.addWait({length: 1});
    r.addSpeakAU('Remember, don\'t hangup *your* phone. Press star to end a call. Or wait for the other person to hang up.');
    callbackUrl += '&start=1';
  }

  let params = {
    waitSound: res.locals.appUrl(`hold_music?campaign_id=${query.campaign_id}`),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: res.locals.appUrl(callbackUrl),
    hangupOnStar: 'true',
    action: res.locals.appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${query.campaign_id}`)
  }
  if (process.env.ENABLE_ANSWER_MACHINE_SHORTCUT) params.digitsMatch = ['2']
  if (campaign.transfer_to_target && campaign.target_number) params.digitsMatch = (params.digitsMatch || []).concat('9')
  r.addConference(`conference-${caller_id}`, params);
  res.send(r.toXML());
});

app.post('/resume_survey', async ({query, body}, res) => {
  const r = plivo.Response()
  if (body.Digits === '1' && query.last_call_id) {
    const call = await Call.query().where({id: query.last_call_id}).first()
    const original_caller_id = call.caller_id
    await call.$query().patch({caller_id: query.caller_id})
    r.addSpeakAU('You have decided to enter the outcome for your last call.')
    r.addRedirect(res.locals.appUrl(`survey?call_id=${call.id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&q=disposition&undo=1`));
    await Event.query().insert({name: 'resume calling', campaign_id: query.campaign_id, caller_id: query.caller_id, call_id: call.id, value: {original_caller_id}})
  } else {
    r.addSpeakAU('Continuing with calling.')
    r.addRedirect(res.locals.appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&resumed=1`));
  }
  res.send(r.toXML());
});

app.all('/hold_music', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  if (campaign && campaign.hold_music) {
    _.shuffle(campaign.hold_music).forEach(filename => r.addPlay(`http://d1bm7er3ouf1yi.cloudfront.net/kooragang-hold-music/${filename}`) )
  } else {
    [1, 2].forEach(i => r.addPlay(`http://d1bm7er3ouf1yi.cloudfront.net/kooragang-hold-music/welcome-pack-${i}.mp3`) )    
  }
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
  } else if (body.ConferenceAction === 'digits' && ['2', '9'].includes(body.ConferenceDigitsMatch)) {
    const call = await Call.query().where({conference_uuid: body.ConferenceUUID}).first();
    if (call) {
      const params = body.ConferenceDigitsMatch === '2' ? {
        call_uuid: body.CallUUID,
        aleg_url: res.locals.appUrl(`survey_result?q=disposition&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}&digit=2`),
      } : {
        call_uuid: call.callee_call_uuid,
        aleg_url: res.locals.appUrl(`transfer_to_target?call_id=${call.id}&campaign_id=${query.campaign_id}`)
      }
      try {
        await plivo_api('transfer_call', params);
      } catch (e) {
        await Event.query().insert({campaign_id: query.campaign_id, name: 'failed_transfer', value: {params, call_id: call.id, error: e, call_uuid: body.CallUUID, conference_uuid: body.ConferenceUUID}});
      }
    }
  }
  res.sendStatus(200);
});

app.post('/transfer_to_target', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  r.addDial().addNumber(campaign.target_number);
  await Event.query().insert({campaign_id: query.campaign_id, name: 'transfer_to_target', value: {call_uuid: body.CallUUID, target_number: campaign.target_number}});
  return res.send(r.toXML());
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
    call = await Call.query().where({conference_uuid: (body.ConferenceUUID || "")}).first();
  }
  if (!call) {
    r.addSpeakAU('You have left the call queue.')
    await Event.query().insert({campaign_id: query.campaign_id, name: 'left queue without call', value: body, caller_id})
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${caller_id}&campaign_id=${query.campaign_id}`));
    return res.send(r.toXML());
  }
  if (call.status === 'machine_detection') {
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
  if (question === 'disposition' && !query.undo) {
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
  await Call.query().where({id: query.call_id}).patch({updated_at: new Date()})

  if (next) {
    r.addRedirect(res.locals.appUrl(`survey?q=${next}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  } else {
    r.addRedirect(res.locals.appUrl(`call_again?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&call_id=${query.call_id}`));
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
  const validDigits = ['1', '0'];
  let message = 'Press 1 to continue calling, or 0 to end your session. ';
  if (query.call_id) {
    validDigits.push('8')
    message += 'Press, 8 to correct your entry, ';
  }
  if (!query.tech_issue_reported) {
    validDigits.push('9')
    message += 'or 9 to report a technical issue.';
  }

  let readyUrl = `ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`
  if (query.call_id) readyUrl += `&call_id=${query.call_id}`
  const callAgain = r.addGetDigits({
    action: res.locals.appUrl(readyUrl),
    timeout: 10,
    retries: 10,
    numDigits: 1,
    validDigits
  });
  callAgain.addSpeakAU(message);
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
      await plivo_api('make_call', params);
    }catch(e){
      await Event.query().insert({name: 'failed_callback', campaign_id: campaign.id, caller_id: caller.id, value: {error: e}})
    }
  }
  return res.sendStatus(200);
});

app.post('/machine_detection', async ({body, query}, res) => {
  try{
    if ( !body.CallUUID ) { throw 'no CallUUID present machine_detection' };
    await Call.query().where({ callee_call_uuid: body.CallUUID }).patch({ status: 'machine_detection' });
    await plivo_api('hangup_call', { call_uuid: body.CallUUID });
  } catch(e){
    const call = body.CallUUID && await Call.query().where({callee_call_uuid: body.CallUUID}).first();
    await Event.query().insert({
      name: 'failed_post_machine_callee_transfer',
      campaign_id: query.campaign_id,
      caller_id: call && call.caller_id,
      call_id: call && call.id,
      value: { error: e }
    })
  }
  res.sendStatus(200);
});

module.exports = app;
