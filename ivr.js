const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const moment = require('moment');
const _ = require('lodash');
const app = express();
const promisfy = require('es6-promisify');
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});
const dialer = require('./dialer');
const questions = require('./questions');

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

const callEndBeep = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/call_end_beep.wav';

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
    await Caller.query().patchAndFetchById(caller.id, {status: 'connecting'});
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
        conference_id: caller.phone_number,
        member_id: caller.conference_member_id,
        text: name,
        language: 'en-GB', voice: 'MAN'
      }
      try{
        await promisfy(api.speak_conference_member.bind(api))(params);
      }catch(e){
        console.error('======= Unable to contact name with:', params, ' and error: ', e);
      }
    }
    r.addConference(caller.phone_number, {
      startConferenceOnEnter: false,
      stayAlone: false,
      callbackUrl: appUrl(`conference_event/callee?caller_number=${caller.phone_number}&campaign_id=${query.campaign_id}`)
    });
    res.send(r.toXML());
  } else {
    await callerTransaction.commit()
    const call = await Call.query().insert({
      log_id: res.locals.log_id,
      callee_id: query.callee_id,
      status: 'dropped',
      dropped: true,
      callee_call_uuid: body.CallUUID
    });
    await Event.query().insert({call_id: call.id, name: 'drop', value: 1})
    res.sendStatus(200);
  }
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
    const {campaign} = await Callee.query().eager('campaign').where({id: call.callee_id}).first();
    await dialer.dial(appUrl(), campaign);
  }
  return next();
});

app.post('/connect', async (req, res, next) => {
  if (req.body.CallStatus === 'completed') return next();

  const r = plivo.Response();
  r.addWait({length: 2});

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
    r.addSpeakAU('An error has occurred. The number is not associated with a campaign');
    r.addWait({length: 1});
    r.addSpeakAU('GetUp technical staff have been notified. Hanging up now.');
    return res.send(r.toXML());
  }

  let callerNumber;
  if (req.query.callback) {
    callerNumber = req.query.number;
  } else {
    const sip = req.body.From.match(/sip:(\w+)@/);
    callerNumber = sip ? sip[1] : req.body.From.replace(/\s/g, '').replace(/^0/, '61');
  }
  if (_.isEmpty(callerNumber)){
    return res.send('It appears you do not have caller id enabled. Please enable it and call back. Thank you.')
  }
  let  caller = await Caller.query().where({phone_number: callerNumber}).first();
  if (!caller){
    caller = await Caller.query().insert({phone_number: callerNumber, first_name: ''});
  }

  const campaignComplete = await dialer.isComplete(campaign);
  if (campaignComplete) {
    r.addSpeakAU(`Hi ${caller.first_name}! Welcome to the GetUp Dialer tool.`);
    r.addWait({length: 1});
    r.addSpeakAU('The campaign has been completed! Please contact the campaign coordinator for further instructions. Thank you and have a great day!');
    return res.send(r.toXML());
  }

  const briefing = r.addGetDigits({
    action: appUrl(`ready?caller_number=${caller.phone_number}&start=1&campaign_id=${campaign.id}`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: ['1', '8', '9']
  });

  if (req.query.callback) {
   briefing.addSpeakAU(`Hi ${caller.first_name}! Welcome back.`);
  } else {
   briefing.addSpeakAU(`Hi ${caller.first_name}! Welcome to the GetUp Dialer tool. Today you will be making calls for the ${campaign.name} campaign.`);
  }
  briefing.addWait({length: 1});
  briefing.addSpeakAU('You should have a copy of the script and the disposition codes in front of you.');
  briefing.addWait({length: 1});
  briefing.addSpeakAU('If not, please press the 8 key');
  briefing.addWait({length: 1});
  if (!req.query.callback) {
    briefing.addSpeakAU('If you cannot afford long phone calls and would like to be called back instead, please press the 9 key');
    briefing.addWait({length: 1});
  }
  briefing.addSpeakAU('Otherwise, press 1 to get started!');
  briefing.addWait({length: 8});
  briefing.addSpeakAU('This message will automatically replay until you select a number on your phone\'s key pad.');
  res.send(r.toXML());
});

app.post('/ready', async (req, res, next) => {
  const r = plivo.Response();
  const caller_number = req.query.caller_number;

  if (req.body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
    return res.send(r.toXML());
  }

  const campaign = await Campaign.query().where({id: req.query.campaign_id}).first();
  if (req.body.Digits === '8') {
    r.addMessage(`Please print or download the script and disposition codes from ${appUrl(`/${campaign.id}`)}. When you are ready, call again!`, {
      src: process.env.NUMBER || '1111111111', dst: caller_number
    });
    r.addSpeakAU('Sending an sms with instructions to your number. Thank you and speak soon!')
    return res.send(r.toXML());
  }
  if (req.body.Digits === '9') {
    r.addSpeakAU('We will call you back immediately. Hanging up now!')
    const params = {
      from: process.env.NUMBER || '1111111111',
      to: caller_number,
      answer_url : appUrl(`connect?campaign_id=${campaign.id}&callback=1&number=${caller_number}`),
      ring_timeout: 120
    };
    try{
      await promisfy(api.make_call.bind(api))(params);
    }catch(e){
      r.addSpeakAU('There was an error calling you back. GetUp staff have been notified. Sorry!')
    }
    return res.send(r.toXML());
  }

  const campaignComplete = await dialer.isComplete(campaign);
  if (campaignComplete) {
    r.addSpeakAU('The campaign has been completed!');
    r.addRedirect(appUrl('disconnect?completed=1'));
    return res.send(r.toXML());
  }

  r.addSpeakAU('You are now in the call queue.')
  if (req.query.start) {
    r.addSpeakAU('We will connect you to a call shortly.')
    r.addWait({length: 1});
    r.addSpeakAU('Remember, don\'t hangup *your* phone. Press star to end a call. Or wait for the other person to hang up.');
  }
  r.addConference(caller_number, {
    waitSound: appUrl('hold_music'),
    maxMembers: 2,
    timeLimit: 60 * 120,
    callbackUrl: appUrl(`conference_event/caller?caller_number=${caller_number}&campaign_id=${req.query.campaign_id}`),
    hangupOnStar: 'true',
    action: appUrl(`survey?q=disposition&caller_number=${caller_number}&campaign_id=${req.query.campaign_id}`)
  });
  res.send(r.toXML());
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
    await Caller.query().where({phone_number: query.caller_number})
      .patch({status: body.ConferenceAction === 'enter' ? 'available' : null, conference_member_id});
    const campaign = await Campaign.query().where({id: query.campaign_id}).first();
    await dialer.dial(appUrl(), campaign);
  }
  res.sendStatus(200);
});

app.post('/call_again', (req, res) => {
  const r = plivo.Response();
  const callAgain = r.addGetDigits({
    action: appUrl(`ready?caller_number=${req.query.caller_number}&campaign_id=${req.query.campaign_id}`),
    timeout: 10,
    retries: 10,
    numDigits: 1
  });
  callAgain.addSpeakAU('Press 1 to continue calling. To finish your calling session, press star.');
  r.addRedirect(appUrl('disconnect'));
  res.send(r.toXML());
});

app.post('/survey', async (req, res) => {
  let call;
  const r = plivo.Response();
  const question = req.query.q;
  const questionData = questions[question];

  if (req.query.call_id) {
    call = await Call.query().where({id: req.query.call_id}).first();
  } else {
    call = await Call.query().where({conference_uuid: req.body.ConferenceUUID}).first();
  }
  if (!call) {
    r.addSpeakAU('The call has ended.');
    r.addSpeakAU('No survey required.');
    return res.send(r.toXML());
  }

  const surveyResponse = r.addGetDigits({
    action: appUrl(`survey_result?q=${question}&caller_number=${req.query.caller_number}&call_id=${call.id}&campaign_id=${req.query.campaign_id}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: Object.keys(questionData.answers),
  });
  if (question === 'disposition') surveyResponse.addSpeakAU('The call has ended.');
  surveyResponse.addSpeakAU(`Enter the ${questionData.name} code.`);
  res.send(r.toXML());
});

app.post('/survey_result', async (req, res) => {
  const r = plivo.Response();
  const question = questions[req.query.q];
  const disposition = question.answers[req.body.Digits];
  const next = question.next(disposition);
  const data = {
    log_id: res.locals.log_id,
    call_id: req.query.call_id,
    question: req.query.q,
    answer: disposition,
  }
  await SurveyResult.query().insert(data);
  r.addSpeakAU(disposition);
  if (next === 'complete') {
    r.addRedirect(appUrl(`call_again?caller_number=${req.query.caller_number}&campaign_id=${req.query.campaign_id}`));
  } else {
    r.addRedirect(appUrl(`survey?q=${next}&call_id=${req.query.call_id}&caller_number=${req.query.caller_number}&campaign_id=${req.query.campaign_id}`));
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

app.get(/^\/\d+$/, async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.path.replace(/^\//, '')}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('campaign.ejs', {campaign, questions})
});

module.exports = app;
