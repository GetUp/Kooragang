'use strict';
const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const app = express();

const logUrl = 'https://calling-tool-endpoint.herokuapp.com/log';
const briefingMessage = 'http://f.cl.ly/items/1a1d3q2D430Y43041d1h/briefing.mp3';

app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 8080));

let host;

app.use((req, res, next) => {
  host = host || `${req.protocol}://${req.hostname}`;
  res.set('Content-Type', 'text/xml');
  next();
});

app.get('/', (req, res) => { res.send('I\'m awake') });

app.get('/connect', (req, res) => {
  const r = plivo.Response();
  r.addWait({length: 2});
  r.addSpeak('Welcome to the GetUp calling tool.', {language: 'en-AU', voice: 'MAN'});

  const params = {
    action: `${host}/call`,
    method: 'POST',
    timeout: '5',
    numDigits: '1',
    retries: '1'
  };
  const getdigits = r.addGetDigits(params);
  getdigits.addSpeak('Hold the line for an introductory briefing, or if you\'ve heard it before, press 1 to skip straight to calling.', {language: 'en-AU', voice: 'MAN'});

  // briefing message
  r.addPlay(briefingMessage);

  r.addRedirect(`${host}/call`);

  res.send(r.toXML());
});

app.post('/call', (req, res) => {
  const r = plivo.Response();

  // terminate the calling loop?
  if (req.body.Digits === '*') {
    r.addRedirect(`${host}/disconnect`);
  } else {
    const callee = retrieveCallee();
    r.addSpeak(`You're about to call ${callee.name} from ${callee.location}`);
    r.addSpeak('Press star at any time to hang up the call.');
    const d = r.addDial({
      action:`${host}/survey`,
      callbackUrl: logUrl,
      hangupOnStar: true
    });
    d.addNumber(callee.number);
  }

  console.log(r.toXML());
  res.send(r.toXML());
});

app.post('/survey', (req, res) => {
  const r = plivo.Response();

  const surveyResponse = r.addGetDigits({
    action: logUrl,
    redirect: false,
    retries: 2
  });
  surveyResponse.addSpeak('Did the person agree to your question?');
  surveyResponse.addSpeak('Press 1 for yes or 2 for no');

  const callAgain = r.addGetDigits({
    action: `${host}/call`,
    timeout: '60',
    numDigits: '1'
  });
  callAgain.addSpeak('Press 1 when you\'re ready to call again or star to finish your calling session.');

  r.addSpeak('No input received.');
  r.addRedirect(`${host}/disconnect`);

  res.send(r.toXML());
});

app.post('/disconnect', (req, res) => {
  const r = plivo.Response();

  r.addSpeak('Thank you very much for calling.');

  const feedback = r.addGetDigits({
    action: `${host}/feedback`,
    timeout: 5,
    retries: 2
  });
  feedback.addSpeak('Press 1 to give feedback about your calling session or simply hang up.');

  res.send(r.toXML());
});

app.post('/feedback', (req, res) => {
  const r = plivo.Response();
  r.addSpeak('Please leave a short 30 second message after the beep.');
  r.addSpeak('If you\'d like a response, be sure to leave your name and number.');
  r.addRecord({
    action: logUrl,
    maxLength: 30,
    finishOnKey: '*'
  });
  r.addSpeak('Sorry, we couldn\'t hear you; please hold the line to try again.');
  r.addRedirect(`${host}/disconnect`);
  res.send(r.toXML());
})

app.listen(app.get('port'), () => {
  console.log('App is running on port', app.get('port'));
});

function retrieveCallee() {
  const callees = [
    {name: 'Tim', location: 'Picnic Point', number: '+61 2 8317 6364'},
    {name: 'Rich', location: 'Alexandria', number: '+61 2 8317 6364'},
    // {name: 'BJ', location: 'Newcastle', number: '+61 468 519 266'},
    {name: 'Kajute', location: 'Melbourne', number: '+61 2 8317 6364'},
  ];
  return callees[Math.floor(Math.random()*callees.length)];
}
