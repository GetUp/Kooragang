'use strict';
const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const app = express();
const webhooks = require('./webhooks');

const logUrl = 'https://calling-tool-endpoint.herokuapp.com/log';
const welcomeMessage = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/welcome7.mp3';
const briefingMessage = 'http://f.cl.ly/items/1a1d3q2D430Y43041d1h/briefing.mp3';
const callEndBeep = 'https://dl.dropboxusercontent.com/u/404666/getup/kooragang/call_end_beep.wav';

app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 8080));

const response = Object.getPrototypeOf(plivo.Response());
response.addSpeakAU = function(text) {
  this.addSpeak(text, {language: 'en-AU', voice: 'MAN'});
};

let host;

app.use((req, res, next) => {
  host = host || `${req.protocol}://${req.hostname}`;
  res.set('Content-Type', 'text/xml');
  next();
});

app.get('/', (req, res) => { res.send('<_-.-_>I\'m awake.</_-.-_>') });

app.get('/connect', (req, res) => {
  const r = plivo.Response();
  r.addWait({length: 2});

  const params = {
    action: `${host}/call`,
    method: 'POST',
    timeout: '5',
    numDigits: '1',
    retries: '1'
  };
  const getdigits = r.addGetDigits(params);
  getdigits.addPlay(welcomeMessage);
  getdigits.addPlay(briefingMessage);

  r.addRedirect(`${host}/call`);

  res.send(r.toXML());
  webhooks(`sessions/${req.query.From}`, { session: 'active', status: 'welcome message', call: {} });
});

app.post('/call', (req, res) => {
  const r = plivo.Response();

  // terminate the calling loop?
  if (req.body.Digits === '*') {
    r.addRedirect(`${host}/disconnect`);
  } else {
    const callee = retrieveCallee();
    r.addSpeakAU(`You're about to call ${callee.name} from ${callee.location}`);
    r.addSpeakAU('Press star at any time to hang up the call.');
    const d = r.addDial({
      callbackUrl: logUrl,
      hangupOnStar: true,
      redirect: false
    });
    d.addNumber(callee.number);
    r.addPlay(callEndBeep);
    webhooks(`sessions/${req.body.From}`, Object.assign({session: 'active', status: 'calling', call: callee}));
  }
  r.addRedirect(`${host}/survey`);
  res.send(r.toXML());
});

app.post('/survey', (req, res) => {
  const r = plivo.Response();
  webhooks(`sessions/${req.body.From}`, {session: 'active', status: 'survey'});

  const surveyResponse = r.addGetDigits({
    action: logUrl,
    redirect: false,
    retries: 2,
    validDigits: ['1', '2']
  });
  surveyResponse.addSpeakAU('Did the person agree to your question. Press 1 for yes or 2 for no');

  const callAgain = r.addGetDigits({
    action: `${host}/call`,
    timeout: '60',
    numDigits: 1
  });
  callAgain.addSpeakAU('Press 1 when you\'re ready to call again or press star to finish your calling session.');

  r.addRedirect(`${host}/disconnect`);

  res.send(r.toXML());
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();
  webhooks(`session/${req.body.From}`, {session: 'active', status: 'feedback', call: {}});

  r.addSpeakAU('Thank you very much for calling.');

  const feedback = r.addGetDigits({
    action: `${host}/feedback`,
    timeout: 5,
    retries: 2
  });
  feedback.addSpeakAU('Press 1 to give feedback about your calling session or simply hang up.');

  res.send(r.toXML());
});

app.post('/feedback', (req, res) => {
  const r = plivo.Response();
  r.addSpeakAU('Please leave a short 30 second message after the beep. If you\'d like a response, be sure to leave your name and number.');
  r.addRecord({
    action: logUrl,
    maxLength: 30,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
})

app.listen(app.get('port'), () => {
  console.log('App is running on port', app.get('port'));
});

let count = 0;
const callees = [
  {name: 'Tim', location: 'Picnic Point', number: '+61 413877188'},
  {name: 'Kajute', location: 'Melbourne', number: '+61 2 8317 6364'}, // success
  {name: 'a busy person', location: 'somewhere at work', number: '+61 2 8318 0746'},  // no thanks
  {name: 'a rude person', location: 'somewhere', number: '+61 2 8318 0738'}, // hangup
];

function retrieveCallee() {
  count += 1
  return callees[count % callees.length];
}
