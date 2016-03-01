const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const moment = require('moment');
const app = express();
const webhooks = require('./webhooks');

const {
  Call,
  Callee,
  Caller,
  Log,
  SurveyResult
} = require('../models');

// const welcomeMessage = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/welcome7.mp3';
// const briefingMessage = 'http://f.cl.ly/items/1a1d3q2D430Y43041d1h/briefing.mp3';
const quarterSec = 'http://www.xamuel.com/blank-mp3-files/quartersec.mp3';
const halfSec = 'http://www.xamuel.com/blank-mp3-files/halfsec.mp3';
const callEndBeep = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/call_end_beep.wav';

app.use(bodyParser.urlencoded({extended: true}));

const response = Object.getPrototypeOf(plivo.Response());
response.addSpeakAU = function(text) {
  this.addSpeak(text, {language: 'en-GB', voice: 'MAN'});
};

let host;

app.use((req, res, next) => {
  if (!host) host = `${req.protocol}://${req.hostname}`;
  res.set('Content-Type', 'text/xml');
  next();
});

const log = ({method, url, body, query, params, headers}, cb) => {
  if (method === 'GET') return cb();
  const UUID = body.CallUUID;
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

app.post('/connect', (req, res, next) => {
  const r = plivo.Response();
  r.addWait({length: 2});

  // uncomment this to record the entire call
  // r.addRecord({
  //   action: appUrl('log'),
  //   maxLength: 60*60,
  //   recordSession: true,
  //   redirect: false
  // });

  Caller.query().where({phone_number: req.body.From}).first().then(caller => {
    if (!caller) {
      r.addSpeakAU('Hi there! We don\'t recognise the number you\'re calling from.');
      r.addSpeakAU('We\'re currently in beta, so only approved callers can use this system.');
      r.addSpeakAU('If you\'d like to help out, please send an email to: take-action, at get up, dot org, dot ay u.');
      r.addSpeakAU('That address again: take-action, at get up, dot org, dot ay u.');
      r.addSpeakAU('Thanks and goodbye.');
      return res.send(r.toXML());
    }

    r.addSpeakAU(`Hi ${caller.first_name}! Thanks for agreeing to call other GetUp members to invite them to your GetTogether.`);
    r.addPlay(quarterSec);
    r.addSpeakAU('If you\'ve heard the briefing before, press 1 at any time to skip straight to calling.');
    r.addPlay(halfSec);

    const briefing = r.addGetDigits({
      action: appUrl(`call?caller_number=${caller.phone_number}`),
      method: 'POST',
      timeout: 5,
      numDigits: 1,
      retries: 10,
      validDigits: [1]
    });

    // session overview
    briefing.addSpeakAU('In this session, you\'ll be calling GetUp members who live near you.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('You\'ll be inviting them to attend your GetTogether, on the 19th, or 20th of March.');
    briefing.addPlay(halfSec);

    // session content
    briefing.addSpeakAU('Tell them about the purpose of the event.  That is, to discuss GetUp\'s election strategy.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('Make sure to let them know the details of the event.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('Also, be sure to tell them how fun it will be, to meet people in their local area with similar values.');
    briefing.addPlay(halfSec);

    // guidelines / process
    briefing.addSpeakAU('During the calls, it\'s important to be very polite and listen.  However, be aware that the more calls you can make, the more people will hear about the Get Together.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('After this message, you\'ll begin calling.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('After each call, there\'ll be a voice prompt to record the result of the call.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('If the call is very short, we won\'t ask you for the result.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('If the call goes straight to voicemail, don\'t worry about leaving a message, just press star, to proceed to the next call.');
    briefing.addPlay(halfSec);
    briefing.addSpeakAU('You\'ll then be given the opportunity to call another member, or finish your session.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('Remember, don\'t hangup *your* phone.  When the call ends, just press star, or alternatively, wait for the other person to hang up.');
    briefing.addPlay(quarterSec);
    briefing.addSpeakAU('Thank you very much for helping with our election effort!');

    briefing.addPlay(halfSec);
    briefing.addSpeakAU('This message will automatically replay until you press 1 on your phone key pad.');

    // briefing.addPlay(welcomeMessage);
    // briefing.addPlay(briefingMessage);

    r.addRedirect(appUrl(`call?caller_number=${caller.phone_number}`));
    // console.log()
    res.send(r.toXML());
    webhooks(`sessions/${req.query.From}`, { session: 'active', status: 'welcome message', call: {} });
  }).catch(next);
});

app.post('/call', (req, res, next) => {
  const r = plivo.Response();

  // terminate the calling loop?
  if (req.body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
    return res.send(r.toXML());
  }

  async.auto({
    findCallee: (cb) => {
      Callee.query()
        .where({caller: req.query.caller_number})
        .andWhere(function() {
          this.whereNull('last_called_at')
            .orWhere('last_called_at', '<', moment().subtract(7, 'days'))
        })
        .first()
        .nodeify((err, row) => {
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

    const callee = results.markCallee;
    r.addSpeakAU(`You're about to call ${callee.first_name} from ${callee.location}`);
    r.addSpeakAU('To hang up the call at any time, press star.');
    const d = r.addDial({
      action: appUrl(`call_log?callee_number=${callee.phone_number}`),
      callbackUrl: appUrl(`call_log?callee_number=${callee.phone_number}`),
      hangupOnStar: true,
      timeout: 30,
      redirect: false
    });
    d.addNumber(callee.phone_number);
    r.addPlay(callEndBeep);
    r.addRedirect(appUrl(`hangup?caller_number=${req.query.caller_number}`));
    webhooks(`sessions/${req.body.From}`, Object.assign({session: 'active', status: 'calling', call: callee}));
    res.send(r.toXML());
  });
});

app.post('/call_log', (req, res, next) => {
  Callee.query().where({phone_number: req.query.callee_number}).first().then(callee => {
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
  const conditions = {status: 'answer', callee_number: req.body.DialBLegTo};
  Call.query().where(conditions).orderBy('created_at', 'desc').first()
    .then(call => {
      if (call && call.created_at < moment().subtract(10, 'seconds')) {
        r.addRedirect(appUrl(`survey?caller_number=${req.query.caller_number}&calleeUUID=${req.body.DialBLegUUID}&calleeNumber=${req.body.DialBLegTo}`));
      } else {
        r.addRedirect(appUrl(`call_again?caller_number=${req.query.caller_number}`));
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
  surveyResponse.addSpeakAU('Are they coming to your Get Together? For "yes", press 1. For "no", press 2. For "maybe", press 3.');
  surveyResponse.addSpeakAU('If we should call them back at a later time, press 7.');
  surveyResponse.addSpeakAU('If the number was incorrect, press 9.');
  surveyResponse.addSpeakAU('To hear these options again, press hash.');

  res.send(r.toXML());
});

const answer = (digit) => {
  const options = {
    '1': 'yes',
    '2': 'no',
    '3': 'maybe',
    '7': 'call_back',
    '9': 'number_incorrect'
  };
  return options[digit];
}

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
    maxLength: 30,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
});

// already logged in middleware
app.post('/log', (req, res) => res.sendStatus(200));

module.exports = app;
