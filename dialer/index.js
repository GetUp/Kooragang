const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const app = express();
const webhooks = require('./webhooks');

const { Log, SurveyResult } = require('../models');

const welcomeMessage = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/welcome7.mp3';
const briefingMessage = 'http://f.cl.ly/items/1a1d3q2D430Y43041d1h/briefing.mp3';
const callEndBeep = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/call_end_beep.wav';

app.use(bodyParser.urlencoded({extended: true}));

const response = Object.getPrototypeOf(plivo.Response());
response.addSpeakAU = function(text) {
  this.addSpeak(text, {language: 'en-AU', voice: 'MAN'});
};

let host;

app.use((req, res, next) => {
  if (!host) host = `${req.protocol}://${req.hostname}`;
  res.set('Content-Type', 'text/xml');
  next();
});

app.use((req, res, next) => log(req, next));

const appUrl = endpoint => `${host}/${endpoint}`;
const logUrl = () => appUrl('log');

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'application/json');
  Log.query().orderBy('id', 'desc').then(res.send.bind(res));
});

app.post('/connect', (req, res) => {
  const r = plivo.Response();
  r.addWait({length: 2});

  const params = {
    action: appUrl('call'),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 1,
    validDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
  };
  const getdigits = r.addGetDigits(params);
  getdigits.addPlay(welcomeMessage);
  getdigits.addPlay(briefingMessage);

  r.addRedirect(appUrl('call'));
  // console.log()
  res.send(r.toXML());
  webhooks(`sessions/${req.query.From}`, { session: 'active', status: 'welcome message', call: {} });
});

app.post('/call', (req, res) => {
  const r = plivo.Response();

  // terminate the calling loop?
  if (req.body.Digits === '*') {
    r.addRedirect(appUrl('disconnect'));
  } else {
    const callee = retrieveCallee();
    r.addSpeakAU(`You're about to call ${callee.name} from ${callee.location}`);
    r.addSpeakAU('To hang up the call at any time, press star.');
    const d = r.addDial({
      action: appUrl('hangup'),
      callbackUrl: logUrl(),
      hangupOnStar: true
    });
    d.addNumber(callee.number);
    webhooks(`sessions/${req.body.From}`, Object.assign({session: 'active', status: 'calling', call: callee}));
  }
  res.send(r.toXML());
});

app.post('/hangup', (req, res) => {
  const r = plivo.Response();
  r.addPlay(callEndBeep);
  if (parseInt(req.body.DialBLegDuration) <= 10) {
    r.addSpeakAU('short call detected; calling again');
    r.addRedirect(appUrl('call_again'));
  }
  r.addRedirect(appUrl(`survey?calleeUUID=${req.body.DialBLegUUID}&calleeNumber=${req.body.DialBLegTo}`));
  res.send(r.toXML());
});

app.post('/call_again', (req, res) => {
  const r = plivo.Response();
  const callAgain = r.addGetDigits({
    action: appUrl('call'),
    timeout: 60,
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
    action: appUrl(`survey_result?q=rsvp&calleeUUID=${req.query.calleeUUID}&calleeNumber=${req.query.calleeNumber}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    validDigits: [1, 2, 3, 7, 9]
  });
  surveyResponse.addSpeakAU('Are they coming to your GetTogether? For no, press 1. For maybe, press 2. For yes, press 3.');
  surveyResponse.addSpeakAU('If we should call them back at a later time, press 7.');
  surveyResponse.addSpeakAU('If the number was incorrect, press 9.');
  surveyResponse.addSpeakAU('To hear these options again, press hash.');

  res.send(r.toXML());
});

const answer = (digit) => {
  const options = {
    '1': 'no',
    '2': 'maybe',
    '3': 'yes',
    '7': 'call_back',
    '9': 'number_incorrect'
  };
  return options[digit];
}

app.post('/survey_result', (req, res, next) => {
  const data = {
    callee_uuid: req.query.calleeUUID,
    callee_number: req.query.calleeNumber,
    question: req.query.q,
    answer: answer(req.body.Digits)
  }
  SurveyResult.query().insert(data).then(() => {
      const r = plivo.Response();
      r.addRedirect(appUrl('call_again'));
      res.send(r.toXML());
    })
    .catch(next);
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
    action: logUrl(),
    maxLength: 30,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
});

const log = ({url, params, headers, body}, cb) => {
  const UUID = body.CallUUID;
  Log.query().insert({UUID, url, params, headers, body}).nodeify(cb)
};

// already logged in middleware
app.post('/log', (req, res) => res.sendStatus(200));

let count = 0;
const callees = [
  {name: 'Community Caller 1', location: 'GetUp Office', number: '+61 455024575'},
  {name: 'Kajute', location: 'Melbourne', number: '+61 2 8317 6364'}, // success
  {name: 'a busy person', location: 'somewhere at work', number: '+61 2 8318 0746'},  // no thanks
  {name: 'a rude person', location: 'somewhere', number: '+61 2 8318 0738'}, // hangup
];

function retrieveCallee() {
  count += 1
  return callees[count % callees.length];
}

module.exports = app;
