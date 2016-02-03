const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const pgp = require('pg-promise')();
const db = pgp(process.env.DATABASE_URL || 'postgres://localhost:5432/cte');
const app = express();
const webhooks = require('./webhooks');

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

const appUrl = endpoint => `${host}/${endpoint}`;
const logUrl = () => appUrl('log');

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'application/json');
  db.query('SELECT * FROM logs ORDER BY id DESC')
    .then(res.send.bind(res))
    .catch(next);
});

app.post('/connect', (req, res) => {
  const r = plivo.Response();
  r.addWait({length: 2});

  const params = {
    action: appUrl('call'),
    method: 'POST',
    timeout: '5',
    numDigits: '1',
    retries: '1'
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
    r.addSpeakAU('Press star at any time to hang up the call.');
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

app.post('/survey', (req, res) => {
  const r = plivo.Response();
  webhooks(`sessions/${req.body.From}`, {session: 'active', status: 'survey'});

  const surveyResponse = r.addGetDigits({
    action: appUrl(`survey_result?q=rsvp&calleeUUID=${req.query.DialBLegUUID}&calleeNumber=${req.query.DialBLegTo}`),
    redirect: true,
    retries: 2,
    validDigits: ['1', '2']
  });
  surveyResponse.addSpeakAU('Did the person agree to your question. Press 1 for yes or 2 for no');

  res.send(r.toXML());
});

app.post('/call_again', (req, res) => {
  const r = plivo.Response();
  const callAgain = r.addGetDigits({
    action: appUrl('call'),
    timeout: '60',
    numDigits: 1
  });
  callAgain.addSpeakAU('Press 1 when you\'re ready to call again or press star to finish your calling session.');

  r.addRedirect(appUrl('disconnect'));

  res.send(r.toXML());
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
  feedback.addSpeakAU('Press 1 to give feedback about your calling session or simply hang up.');

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

const log = (body, cb) => {
  db.none('INSERT INTO logs(created_at, body) VALUES($1, $2)', [new Date(), body])
    .then(cb)
    .catch(cb);
}

app.post('/log', (req, res) => log(res.body, (err) => res.sendStatus(err ? 500 : 200)));

app.post('/survey_result', (req, res, next) => {
  const data = {
    callee_uuid: req.query.calleeUUID,
    callee_number: req.query.calleeNumber,
    question: req.query.q,
    answer: req.body.Digits
  }
  const values = Object.keys(data).map(datum => `\$\{${datum}\}`)
  db.none(`INSERT INTO survey_results(${Object.keys(data)}) VALUES(${values.join()})`, data)
    .then(() => {
      const r = plivo.Response();
      r.addRedirect(appUrl('call_again'));
      res.send(r.toXML());
    })
    .catch(next);
});

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
