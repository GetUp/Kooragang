const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const moment = require('moment');
const _ = require('lodash');
const app = express();
const promisify = require('es6-promisify');
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});
const dialer = require('./dialer');

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
  const callerTransaction = await transaction.start(Caller.knex());
  const caller = await Caller.bindTransaction(callerTransaction).query()
    .where({status: 'available'}).orderBy('updated_at').first();
  if (caller) {
    await Caller.query().patchAndFetchById(caller.id, {status: 'in-call'});
    await callerTransaction.commit()
    await Call.query().insert({
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
        await promisify(api.speak_conference_member.bind(api))(params);
      }catch(e){
        console.error('======= Unable to contact name with:', params, ' and error: ', e);
      }
    }
    r.addConference(`conference-${caller.id}`, {
      startConferenceOnEnter: false,
      stayAlone: false,
      callbackUrl: appUrl(`conference_event/callee?caller_id=${caller.id}&campaign_id=${query.campaign_id}`)
    });
  } else {
    await callerTransaction.commit()
    const call = await Call.query().insert({
      log_id: res.locals.log_id,
      callee_id: query.callee_id,
      status: 'dropped',
      dropped: true,
      callee_call_uuid: body.CallUUID
    });
    let campaign = await Campaign.query().where({id: query.campaign_id}).first();
    const calls_in_progress = campaign.calls_in_progress;
    campaign = await dialer.decrementCallsInProgress(campaign);
    await Event.query().insert({call_id: call.id, name: 'drop', value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress} })
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
    await Event.query().insert({call_id: call.id, name: 'filter', value: {status, calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress}})
    await dialer.dial(appUrl(), campaign);
  }
  res.sendStatus(200);
});

app.post('/connect', async (req, res, next) => {
  if (req.body.CallStatus === 'completed') return res.sendStatus(200);

  const r = plivo.Response();

  if (process.env.RECORD_CALLS === 'true') {
    r.addRecord({
      action: appUrl('log'),
      maxLength: 60*60,
      recordSession: true,
      redirect: false
    });
  }

  const campaign = await Campaign.query().where({id: req.query.campaign_id}).first();
  if (!campaign){
    r.addWait({length: 2});
    r.addSpeakAU('An error has occurred. The number is not associated with a campaign');
    r.addWait({length: 1});
    r.addSpeakAU('GetUp technical staff have been notified. Hanging up now.');
    return res.send(r.toXML());
  }

  const callerNumber = extractCallerNumber(req.query, req.body);
  if (_.isEmpty(callerNumber)){
    r.addWait({length: 2});
    r.addSpeakAU('It appears you do not have caller id enabled. Please enable it and call back. Thank you.');
    return res.send(r.toXML());
  }

  const campaignComplete = await dialer.isComplete(campaign);
  if (campaignComplete) {
    r.addWait({length: 2});
    r.addSpeakAU(`Hi! Welcome to the GetUp Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU('The campaign has been completed! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  const briefing = r.addGetDigits({
    action: appUrl(`ready?campaign_id=${campaign.id}&caller_number=${callerNumber}&start=1`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: ['1', '8', '9']
  });

  briefing.addWait({length: 2});
  if (req.query.callback) {
    briefing.addSpeakAU(`Hi! Welcome back.`);
  } else {
    briefing.addSpeakAU(`Hi! Welcome to the GetUp Dialer tool. Today you will be making calls for the ${campaign.name} campaign.`);
    briefing.addWait({length: 1});
    briefing.addSpeakAU('If you cannot afford long phone calls and would like to be called back instead, please press the 8 key');
  }
  briefing.addWait({length: 1});
  briefing.addSpeakAU('You should have a copy of the script and the disposition codes in front of you.');
  briefing.addWait({length: 1});
  briefing.addSpeakAU('If not, please press the 9 key');
  briefing.addWait({length: 1});
  briefing.addSpeakAU('Otherwise, press 1 to get started!');
  briefing.addWait({length: 8});
  briefing.addSpeakAU('This message will automatically replay until you select a number on your phone\'s key pad.');
  res.send(r.toXML());
});

app.post('/ready', async (req, res, next) => {
  const r = plivo.Response();
  let caller_id;
  if (req.query.start) {
    if (req.body.Digits === '9') {
      r.addMessage(`Please print or download the script and disposition codes from ${appUrl(req.query.campaign_id)}. When you are ready, call again!`, {
        src: process.env.NUMBER || '1111111111', dst: req.query.caller_number
      });
      r.addSpeakAU('Sending an sms with instructions to your number. Thank you and speak soon!')
      return res.send(r.toXML());
    }
    const caller = await Caller.query().insert({phone_number: req.query.caller_number, call_uuid: req.body.CallUUID});
    caller_id = caller.id;
  } else {
    caller_id = req.query.caller_id;
  }

  if (req.body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
    return res.send(r.toXML());
  }

  if (req.body.Digits === '8') {
    await Caller.query().where({id: caller_id}).patch({callback: true});
    r.addSpeakAU('We will call you back immediately. Please hang up now!');
    return res.send(r.toXML());
  }

  const campaign = await Campaign.query().where({id: req.query.campaign_id}).first();
  const campaignComplete = await dialer.isComplete(campaign);
  if (campaignComplete) {
    r.addSpeakAU('The campaign has been completed!');
    r.addRedirect(appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  r.addSpeakAU('You are now in the call queue.')
  let callbackUrl = `conference_event/caller?caller_id=${caller_id}&campaign_id=${req.query.campaign_id}`;
  if (req.query.start) {
    r.addSpeakAU('We will connect you to a call shortly.')
    r.addWait({length: 1});
    r.addSpeakAU('Remember, don\'t hangup *your* phone. Press star to end a call. Or wait for the other person to hang up.');
    callbackUrl += '&start=1';
  }
  r.addConference(`conference-${caller_id}`, {
    waitSound: appUrl('hold_music'),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: appUrl(callbackUrl),
    hangupOnStar: 'true',
    digitsMatch: ['2'],
    action: appUrl(`survey?q=disposition&caller_id=${caller_id}&campaign_id=${req.query.campaign_id}`)
  });
  res.send(r.toXML());
});

app.post('/call_ended', async (req, res) => {
  const campaign = await Campaign.query().where({id: req.query.campaign_id}).first();

  const caller = await Caller.query().where({call_uuid: req.body.CallUUID}).first();
  if (!caller) {
    await Event.query().insert({campaign_id: campaign.id, name: 'unknown call ended', value: req.body});
    return res.sendStatus(200);
  }

  if(caller.status === 'in-call') await dialer.decrementCallsInProgress(campaign);
  await caller.$query().patch({status: 'complete'});
  await Event.query().insert({campaign_id: campaign.id, name: 'caller_complete', value: {caller_id: caller.id}})

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
      await Event.query().insert({campaign_id: campaign.id, name: 'failed_callback', value: {caller_id: caller.id, error: e}})
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
    await Caller.query().where({id: query.caller_id})
      .patch({status: 'available', conference_member_id, updated_at: new Date()});
    let campaign = await Campaign.query().where({id: query.campaign_id}).first();
    const calls_in_progress = campaign.calls_in_progress;
    if (query.start) {
      await Event.query().insert({campaign_id: campaign.id, name: 'join', value: {calls_in_progress}})
    }else {
      campaign = await dialer.decrementCallsInProgress(campaign);
      await Event.query().insert({campaign_id: campaign.id, name: 'available', value: {calls_in_progress, updated_calls_in_progress: campaign.calls_in_progress}})
    }
    await dialer.dial(appUrl(), campaign);
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

app.post('/call_again', (req, res) => {
  const r = plivo.Response();
  const callAgain = r.addGetDigits({
    action: appUrl(`ready?caller_id=${req.query.caller_id}&campaign_id=${req.query.campaign_id}`),
    timeout: 10,
    retries: 10,
    numDigits: 1
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
  surveyResponse.addSpeakAU(`Enter the ${questionData.name} code.`);
  res.send(r.toXML());
});

app.post('/survey_result', async ({query, body}, res) => {
  const r = plivo.Response();
  const campaign = await Campaign.query().where({id: query.campaign_id}).first();
  const questions = campaign.questions;
  const question = questions[query.q];
  const disposition = question.answers[body.Digits || query.digit].value;
  const next = question.answers[body.Digits || query.digit].next;
  const data = {
    log_id: res.locals.log_id,
    call_id: query.call_id,
    question: query.q,
    answer: disposition,
  }
  await SurveyResult.query().insert(data);
  r.addSpeakAU(disposition);
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

app.post('/fallback', (req, res) => {
  const r = plivo.Response()
  r.addSpeakAU('Dreadfully sorry; an error has occurred. Please call back to continue.')
  res.send(r.toXML())
});

app.get(/^\/\d+$/, async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.path.replace(/^\//, '')}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('campaign.ejs', {campaign, questions})
});

const extractCallerNumber = (query, body) => {
  if (query.callback) {
    return query.number;
  } else {
    const sip = body.From.match(/sip:(\w+)@/);
    return sip ? sip[1] : body.From.replace(/\s/g, '').replace(/^0/, '61');
  }
};

function sleep(ms = 0) {
  const timeout = process.env.NODE_ENV === "test" ? 0 : ms;
  return new Promise(r => setTimeout(r, timeout));
}

module.exports = app;
