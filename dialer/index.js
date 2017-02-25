const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const moment = require('moment');
const app = express();
const webhooks = require('./webhooks');
const promisfy = require("es6-promisify");
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});

const {
  Call,
  Callee,
  Caller,
  Log,
  SurveyResult
} = require('../models');

const quarterSec = 'http://www.xamuel.com/blank-mp3-files/quartersec.mp3';
const halfSec = 'http://www.xamuel.com/blank-mp3-files/halfsec.mp3';
const callEndBeep = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/call_end_beep.wav';

app.use(bodyParser.urlencoded({extended: true}));

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
  if (process.env.NODE_ENV === 'development') console.error('REQUEST', {UUID, url, body, query, params, headers})
  Log.query().insert({UUID, url, body, query, params, headers}).nodeify(cb);
};

app.use((req, res, next) => {
  if (req.method === 'GET') return next();
  log(req, (err, result) => {
    res.locals.log_id = result.id;
    next();
  });
});

const appUrl = endpoint => `${host}/${endpoint}`;

app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'));

const unapprovedCaller = (r, res) => {
  r.addSpeakAU('Hi there! We don\'t recognise the number you\'re calling from.');
  r.addSpeakAU('We\'re currently in beta, so only approved callers can use this system.');
  r.addSpeakAU('If you\'d like to help out, please send an email to: take-action, at get up, dot org, dot ay u.');
  r.addSpeakAU('That address again: take-action, at get up, dot org, dot ay u.');
  r.addSpeakAU('Thanks and goodbye.');
  res.send(r.toXML());
}

const answer = (digit) => {
  return {
    '1': 'machine',
    '2': 'no answer',
    '3': 'callback',
    '4': 'not interested',
    '5': 'disagree',
    '6': 'undecided',
    '7': 'agree',
    '8': 'take action',
    '9': 'error'
  }[digit];
}

app.post('/connect', async (req, res, next) => {
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

  const callerNumber = req.body.From.replace(/\s/g, '').slice(-9);
  caller = await Caller.query().where('phone_number', 'like', '%' + callerNumber).first();
  if (!caller) return unapprovedCaller(r, res);
  const conferenceName = caller.phone_number;
  try{
    await promisfy(api.get_live_conference)({conference_id: conferenceName});
  }catch(err){
    if (err !== 404) return next(`${conferenceName} conference exists with status ${err}`);
  }

  const briefing = r.addGetDigits({
    action: appUrl(`call?caller_number=${caller.phone_number}`),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: [1]
  });

  briefing.addSpeakAU(`Hi ${caller.first_name}! Welcome to the GetUp Power Dialer tool. Today you will be making calls about the Adani campaign.`);
  briefing.addPlay(halfSec);
  briefing.addSpeakAU('You should have a document in front of you with the script and the reference codes for each survey question.');
  briefing.addPlay(quarterSec);
  briefing.addSpeakAU('If not, please hang up and contact the campaign coordinator and call back when you have the instructions you need.');
  briefing.addPlay(halfSec);
  briefing.addPlay(halfSec);

  briefing.addSpeakAU('Remember, don\'t hangup *your* phone.  When the call ends, just press star, or wait for the other person to hang up.');
  briefing.addPlay(quarterSec);
  briefing.addSpeakAU('Thank you very much for being part of this campaign. Let\'s get started!');

  briefing.addPlay(halfSec);
  briefing.addSpeakAU('This message will automatically replay until you press 1 on your phone key pad.');

  r.addRedirect(appUrl(`conference?caller_number=${caller.phone_number}`));
  webhooks(`sessions/${req.query.From}`, { session: 'active', status: 'welcome message', call: {} });
  res.send(r.toXML());
});

/*
app.post('/conference', (req, res, next) => {
  const r = plivo.Response();
  const caller= req.query.caller_number;
  r.addConference({
    //endConferenceOnExit: true,
  })
});
*/


app.post('/call', (req, res, next) => {
  const r = plivo.Response();

  // terminate the calling loop?
  if (req.body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
    return res.send(r.toXML());
  }

  async.auto({
    findCallee: (cb) => {
      const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
      const calleeQuery = Callee.query()
        .select('callees.*', Callee.raw(`${cleanedNumber} as cleaned_number`))
        .whereRaw(`length(${cleanedNumber}) = 11`)
        .andWhere(function() {
          this.whereNull('last_called_at')
            .orWhere('last_called_at', '<', moment().subtract(7, 'days'))
        })
        .first();
      calleeQuery.nodeify((err, row) => {
        if (err) return cb(err);
        if (row) return cb(null, row);

        r.addSpeakAU('Sorry, there are no more numbers left to call.')
        r.addRedirect(appUrl('disconnect'));
        res.send(r.toXML());
      });
    },
    markCallee: ['findCallee', (cb, results) => {
      Callee.query()
        .patchAndFetchById(results.findCallee.id, {last_called_at: new Date})
        .nodeify(cb);
    }]
  }, (err, results) => {
    if (err) return next(err);

    const callee = results.findCallee;
    r.addSpeakAU('Resuming calling.');
    r.addSpeakAU('To hang up the call at any time, press star.');
    const d = r.addDial({
      action: appUrl(`call_log?callee_number=${callee.cleaned_number}`),
      callbackUrl: appUrl(`call_log?callee_number=${callee.cleaned_number}`),
      confirmSound: appUrl(`confirm_sound?callee_number=${callee.cleaned_number}`),
      confirmKey: '#',
      hangupOnStar: true,
      timeout: 30,
      redirect: false
    });
    d.addNumber(callee.cleaned_number);
    r.addPlay(callEndBeep);
    r.addRedirect(appUrl(`hangup?caller_number=${req.query.caller_number}`));
    webhooks(`sessions/${req.body.From}`, Object.assign({session: 'active', status: 'calling', call: callee}));
    res.send(r.toXML());
  });
});

app.post('/confirm_sound', (req, res, next) => {
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const calleeQuery = Callee.query().whereRaw(`${cleanedNumber} = '${req.query.callee_number}'`).first();
  calleeQuery.then(callee => {
    const r = plivo.Response();
    r.addSpeakAU(`Press hash to connect to ${callee.first_name}`);
    res.send(r.toXML());
  }).catch(next);
});

app.post('/call_log', (req, res, next) => {
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const calleeQuery = Callee.query().whereRaw(`${cleanedNumber} = '${req.query.callee_number}'`).first();
  calleeQuery.then(callee => {
    Call.query().insert({
      log_id: res.locals.log_id,
      callee_id: callee.id,
      status: req.body.DialBLegStatus,
      caller_uuid: req.body.DialALegUUID,
      caller_number: req.body.DialBLegFrom,
      callee_uuid: req.body.DialBLegUUID,
      callee_number: req.body.DialBLegTo
    }).nodeify(next);
  }).catch(next);
});

app.post('/hangup', (req, res, next) => {
  const r = plivo.Response();

  if (req.body.CallStatus !== 'completed') {
    r.addRedirect(appUrl(`call_again?caller_number=${req.query.caller_number}`));
    return res.send(r.toXML());
  }

  const conditions = {status: 'answer', callee_number: req.body.DialBLegTo};
  const callQuery = Call.query().where(conditions).orderBy('created_at', 'desc').first();
  callQuery.then(call => {
    if (call && call.created_at > moment().subtract(10, 'seconds')) {
      r.addRedirect(appUrl(`call_again?caller_number=${req.query.caller_number}`));
    } else {
      r.addRedirect(appUrl(`survey?caller_number=${req.query.caller_number}&calleeUUID=${req.body.DialBLegUUID}&calleeNumber=${req.body.DialBLegTo}`));
    }
    res.send(r.toXML());
  }).catch(next);
});

app.post('/call_again', (req, res) => {
  const r = plivo.Response();
  const callAgain = r.addGetDigits({
    action: appUrl(`call?caller_number=${req.query.caller_number}`),
    timeout: 10,
    retries: 6,
    numDigits: 1
  });
  callAgain.addSpeakAU('When you\'re ready to call again, press 1. To finish your calling session, press star.');

  r.addRedirect(appUrl('disconnect'));

  res.send(r.toXML());
});

app.post('/survey', (req, res) => {
  const r = plivo.Response();
  webhooks(`sessions/${req.body.From}`, {session: 'active', status: 'survey'});

  const surveyResponse = r.addGetDigits({
    action: appUrl(`survey_result?q=rsvp&caller_number=${req.query.caller_number}&calleeUUID=${req.query.calleeUUID}&calleeNumber=${req.query.calleeNumber}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    validDigits: [1, 2, 3, 7, 9]
  });
  surveyResponse.addSpeakAU('Enter the answer code');

  res.send(r.toXML());
});

app.post('/survey_result', (req, res, next) => {
  const data = {
    log_id: res.locals.log_id,
    caller_uuid: req.body.CallUUID,
    callee_uuid: req.query.calleeUUID,
    callee_number: req.query.calleeNumber,
    question: req.query.q,
    answer: answer(req.body.Digits)
  }
  SurveyResult.query().insert(data).then(() => {
    const r = plivo.Response();
    r.addRedirect(appUrl(`call_again?caller_number=${req.query.caller_number}`));
    res.send(r.toXML());
  }).catch(next);
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();
  webhooks(`session/${req.body.From}`, {session: 'active', status: 'feedback', call: {}});

  r.addSpeakAU('Thank you very much for calling.');

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

module.exports = app;
