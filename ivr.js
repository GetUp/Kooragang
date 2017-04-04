const express = require('express');
const moment = require('moment');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const _ = require('lodash');
const app = express();
const promisify = require('es6-promisify');
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});
const dialer = require('./dialer');
const {
  sleep,
  extractCallerNumber,
  extractCalleeNumber,
  authenticationNeeded,
  introductionNeeded,
  validPasscode
} = require('./utils');
const {
  Call,
  Callee,
  Caller,
  Campaign,
  Log,
  SurveyResult,
  Event,
  transaction
} = require('./models');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'))
app.set('view engine', 'ejs');

const response = Object.getPrototypeOf(plivo.Response());
response.addSpeakAU = function(text) {
  this.addSpeak(text, {language: 'en-GB', voice: 'MAN'});
};

let host= process.env.BASE_URL;

app.use((req, res, next) => {
  if (!host) host = `${req.protocol}://${req.hostname}`;
  res.set('Content-Type', 'text/xml');
  next();
});

const log = ({method, url, body, query, params, headers}, cb) => {
  if (method === 'GET') return cb();
  const UUID = body.CallUUID;
  if (process.env.NODE_ENV === 'development') console.error('REQUEST', {UUID, url, body})
  Log.query().insert({UUID, url, body, query, params, headers}).nodeify(cb);
};

app.use((req, res, next) => {
  if (req.method === 'GET') return next();
  log(req, (err, result) => {
    res.locals.log_id = result.id;
    next();
  });
});

const appUrl = endpoint => endpoint ? `${host}/${endpoint}` : host;

app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'));

app.post('/answer', async ({body, query}, res, next) => {
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
        if (!process.env.SPEAK_NAMES) await promisify(api.speak_conference_member.bind(api))(params);
      }catch(e){}
    }

    await Event.query().insert({name: 'answered', campaign_id: campaign.id, call_id: call.id, caller_id: caller.id, value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress, seconds_waiting} })
    r.addConference(`conference-${caller.id}`, {
      startConferenceOnEnter: false,
      stayAlone: false,
      callbackUrl: appUrl(`conference_event/callee?caller_id=${caller.id}&campaign_id=${query.campaign_id}`)
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
    await Event.query().insert({call_id: call.id, name: status, value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress, errorFindingCaller} })
    r.addHangup({reason: 'drop'});
  }
  res.send(r.toXML());
});

app.post('/hangup', async ({body, query}, res, next) => {
  let call = await Call.query().where({callee_call_uuid: body.CallUUID}).first();
  const status = body.Machine === 'true' ? 'machine_detected' : body.CallStatus;
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

app.post('/connect', async ({body, query}, res, next) => {
  if (body.CallStatus === 'completed') return res.sendStatus(200);
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();

  if (process.env.RECORD_CALLS === 'true') {
    r.addRecord({
      action: appUrl('log'),
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
  const promptIntro = introductionNeeded(query.entry);

  if (campaign.status === "paused" || campaign.status === null){
    r.addWait({length: 2});
    r.addSpeakAU('Hi! Welcome to the GetUp Dialer tool.');
    r.addWait({length: 1});
    r.addSpeakAU('The campaign is currently paused! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  const callerNumber = extractCallerNumber(query, body);
  if (_.isEmpty(callerNumber)){
    r.addWait({length: 2});
    r.addSpeakAU('It appears you do not have caller id enabled. Please enable it and call back. Thank you.');
    return res.send(r.toXML());
  }

  const campaignComplete = await dialer.isComplete(campaign);
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
      action: appUrl(`passcode?campaign_id=${query.campaign_id}`),
      timeout: 10,
      retries: 10,
      numDigits: campaign.passcode.length
    });
    r.addRedirect(appUrl('passcode'));
    return res.send(r.toXML());
  }

  let valid_digits = ['1', '2', '3', '4'];
  if(Object.keys(campaign.more_info).length > 0) {
    let more_info_digits = Object.keys(campaign.more_info);
    valid_digits = valid_digits.concat(more_info_digits);
  }

  const briefing = r.addGetDigits({
    action: appUrl(`ready?campaign_id=${campaign.id}&caller_number=${callerNumber}&start=1&authenticated=${query.authenticated ? '1' : '0'}`),
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

app.post('/ready', async ({body, query}, res, next) => {
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
  const campaignComplete = await dialer.isComplete(campaign);
  if (campaignComplete) {
    r.addSpeakAU('The campaign has been completed!');
    r.addRedirect(appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  if (body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
    return res.send(r.toXML());
  }

  if (body.Digits === '2') {
    await Caller.query().where({id: caller_id}).patch({callback: true});
    r.addSpeakAU('We will call you back immediately. Please hang up now!');
    return res.send(r.toXML());
  }

  if (body.Digits === '4') {
    r.addSpeakAU("Welcome to the Get Up dialer tool! This system works by dialing a number of people and patching them through to you when they pick up. Until they pick up, you'll hear music playing. When the music stops, that's your queue to start talking. Then you can attempt to have a conversation with them. At the end of the conversation, you'll be prompted to enter numbers into your phone to indicate the outcome of the call. It's important to remember that you never have to hang up your phone to end a call. If you need to end a call, just press star.");
    r.addRedirect(appUrl(`connect?campaign_id=${campaign.id}&entry=more_info&entry_key=4&authenticated=${query.authenticated}`));
    return res.send(r.toXML());
  }

  if(Object.keys(campaign.more_info).length > 0 && Object.keys(campaign.more_info).includes(body.Digits)) {
    r.addSpeakAU(campaign.more_info[body.Digits].content);
    r.addRedirect(appUrl(`connect?campaign_id=${campaign.id}&entry=more_info&entry_key=${body.Digits}&authenticated=${query.authenticated}`));
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
    waitSound: appUrl('hold_music'),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: appUrl(callbackUrl),
    hangupOnStar: 'true',
    action: appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${query.campaign_id}`)
  }
  if (process.env.ENABLE_ANSWER_MACHINE_SHORTCUT) params.digitsMatch = ['2']
  r.addConference(`conference-${caller_id}`, params);
  res.send(r.toXML());
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
      answer_url: appUrl(`connect?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      hangup_url: appUrl(`call_ended?campaign_id=${campaign.id}&callback=1&number=${caller.phone_number}`),
      ring_timeout: 120
    };
    try{
      await sleep(5000);
      await promisify(api.make_call.bind(api))(params);
    }catch(e){
      await Event.query().insert({name: 'failed_callback', campaign_id: campaign.id, caller_id: caller.id, value: {error: e}})
    }
  }
  return res.sendStatus(200);
});

app.post('/hold_music', (req, res) => {
  const r = plivo.Response();
  _(1).range(7)
    .each(i => r.addPlay(`http://holdmusic.io/public/welcome-pack/welcome-pack-${i}.mp3`) )
  res.send(r.toXML());
});

app.post('/conference_event/callee', async ({query, body}, res, next) => {
  if (body.ConferenceAction === 'enter'){
    await Call.query().where({callee_call_uuid: body.CallUUID}).patch({
      conference_uuid: body.ConferenceUUID,
      status: 'connected', connected_at: new Date()
    });
  }
  res.sendStatus(200);
});

app.post('/conference_event/caller', async ({query, body}, res, next) => {
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
        aleg_url: appUrl(`survey_result?q=disposition&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}&digit=2`),
      }
      try {
        await promisify(api.transfer_call.bind(api))(params);
      } catch (e) {
        await Event.query().insert({campaign_id: query.campaign_id, name: 'failed_transfer', value: {call_id: call.id, error: e, call_uuid: body.CallUUID, conference_uuid: body.ConferenceUUID}});
      }
    }
  }
  res.sendStatus(200);
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
    action: appUrl(`ready?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`),
    timeout: 10,
    retries: 10,
    numDigits: 1,
    validDigits: ['1', '*']
  });
  callAgain.addSpeakAU('Press 1 to continue calling. To finish your calling session, press star.');
  r.addRedirect(appUrl('disconnect'));
  res.send(r.toXML());
});

app.post('/survey', async ({query, body}, res) => {
  let call;
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const questions = campaign.questions;
  const question = query.q;
  const questionData = questions[question];
  if (query.call_id) {
    call = await Call.query().where({id: query.call_id}).first();
  } else {
    call = await Call.query().where({conference_uuid: body.ConferenceUUID}).first();
  }
  if (!call) {
    r.addSpeakAU('The call has ended.');
    r.addSpeakAU('No survey required.');
    return res.send(r.toXML());
  }
  const surveyResponse = r.addGetDigits({
    action: appUrl(`survey_result?q=${question}&caller_id=${query.caller_id}&call_id=${call.id}&campaign_id=${query.campaign_id}`),
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

  const type = question.type;
  const deliver = question.answers[body.Digits || query.digit].deliver;
  const content = question.answers[body.Digits || query.digit].content;
  const calleeNumber = extractCalleeNumber(query, body);

  r.addSpeakAU(disposition);
  const sendDropInfoSMS = (content, calleeNumber) => {
    r.addMessage(`${content}`, {
      src: campaign.sms_number || process.env.NUMBER || '1111111111',
      dst: calleeNumber
    });
  }
  if (type === 'SMS' && deliver) {
    const call = await Call.query().where({id: query.call_id}).eager('callee').first();
    sendDropInfoSMS(content, call.callee.phone_number);
  }
  const data = {
    log_id: res.locals.log_id,
    call_id: query.call_id,
    question: query.q,
    answer: disposition,
  }
  await SurveyResult.query().insert(data);

  if (next) {
    r.addRedirect(appUrl(`survey?q=${next}&call_id=${query.call_id}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  } else {
    r.addRedirect(appUrl(`call_again?caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`));
  }
  res.send(r.toXML());
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();

  r.addSpeakAU('Thank you very much for volunteering on this campaign.');

  const feedback = r.addGetDigits({
    action: appUrl('feedback'),
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
    action: appUrl('log'),
    maxLength: 60,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
});
// already logged in middleware
app.post('/log', (req, res) => res.sendStatus(200));

app.post('/fallback', async ({body, query}, res) => {
  await Event.query().insert({campaign_id: query.campaign_id, name: 'caller fallback', value: body})
  const r = plivo.Response()
  r.addSpeakAU('Dreadfully sorry; an error has occurred. Please call back to continue.')
  res.send(r.toXML())
});

app.post('/callee_fallback', async ({body, query}, res) => {
  await Event.query().insert({campaign_id: query.campaign_id, name: 'callee fallback', value: {body, query}})
  const r = plivo.Response()
  r.addHangup()
  res.send(r.toXML())
});

app.post('/passcode', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const authenticatedCaller = validPasscode(campaign.passcode, body.Digits);

  if (authenticatedCaller) {
    r.addWait({length: 1});
    r.addSpeakAU('Thanks for that.')
    r.addWait({length: 1});
    r.addRedirect(appUrl(`connect?campaign_id=${campaign.id}&authenticated=1`));
    return res.send(r.toXML());
  }

  r.addWait({length: 1});
  r.addSpeakAU('You have entered the incorrect passcode. Please call back and try again.')
  r.addWait({length: 1});
  r.addHangup();
  res.send(r.toXML());
});

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
});

module.exports = app;
