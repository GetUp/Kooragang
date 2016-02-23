const express = require('express');
const plivo = require('plivo');
const bodyParser = require('body-parser');
const async = require('async');
const moment = require('moment');
const app = express();
const webhooks = require('./webhooks');

const { Call, Callee, Log, SurveyResult } = require('../models');

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

app.use((req, res, next) => {
  if (req.method === 'GET') return next();
  log(req, (err, result) => {
    res.locals.log_id = result.id;
    next();
  })
});

const appUrl = endpoint => `${host}/${endpoint}`;

app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'));

app.post('/connect', (req, res) => {
  const r = plivo.Response();
  r.addWait({length: 2});

  // r.addRecord({
  //   action: appUrl('log'),
  //   maxLength: 60*60,
  //   recordSession: true,
  //   redirect: false
  // });

  r.addSpeakAU('Hi! Thanks for agreeing to call other GetUp members for the Solar Supercharge Social Event.');
  r.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  r.addSpeakAU('If you\'ve heard the briefing before, press 1 at any time to skip straight to calling.');

  const params = {
    action: appUrl('call'),
    method: 'POST',
    timeout: 5,
    numDigits: 1,
    retries: 10,
    validDigits: [1]
  };

  const briefing = r.addGetDigits(params);
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/halfsec.mp3');
  briefing.addSpeakAU('In this session, you\'ll be calling GetUp members who\'ve volunteered within the past year and live in Brisbane.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('You\'ll be inviting them to attend the "Solar Supercharge Social Event" this coming Sunday.');

  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/halfsec.mp3');
  briefing.addSpeakAU('The event will be hosted by GetUp\'s National Director, Paul Oosting and GetUp\'s Renewable Energy Campaigner, Miriam Lions.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('The event will be for the most committed GetUp members to hear all about the plans for the upcoming federal election.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('The event will be on Sunday night, February 14th, between 6pm and 7 30pm at "Irish Murphy\'s" pub in Queen Street Mall, Brisbane.');

  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/halfsec.mp3');
  briefing.addSpeakAU('During the calls, it\'s important to be very polite and listen.  However, be aware that the more calls you can make, the more people will hear about this fantastic opportunity to support renewable energy.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('After this message, you\'ll dive straight into calling.  After each call, there\'ll be a voice prompt to record the result of the call, and you\'ll be given the opportunity to call another member, or finish your session.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('If the call goes straight to voicemail, don\'t worry about leaving a message.');
  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/quartersec.mp3');
  briefing.addSpeakAU('Thank you very much for helping to spread the word about the Solar Supercharge Social Event.');

  briefing.addPlay('http://www.xamuel.com/blank-mp3-files/halfsec.mp3');
  briefing.addSpeakAU('This message will automatically replay until you press 1 on your phone key pad.');

  // briefing.addPlay(welcomeMessage);
  // briefing.addPlay(briefingMessage);

  r.addRedirect(appUrl('call'));
  // console.log()
  res.send(r.toXML());
  webhooks(`sessions/${req.query.From}`, { session: 'active', status: 'welcome message', call: {} });
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
        .whereNull('last_called_at')
        .orWhere('last_called_at', '<', moment().subtract(7, 'days'))
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
      callbackUrl: appUrl(`call_log?destination=${callee.phone_number}`),
      hangupOnStar: true,
      timeout: 30,
      redirect: false
    });
    d.addNumber(callee.phone_number);
    r.addPlay(callEndBeep);
    r.addRedirect(appUrl('hangup'));
    webhooks(`sessions/${req.body.From}`, Object.assign({session: 'active', status: 'calling', call: callee}));
    res.send(r.toXML());
  });
});

app.post('/hangup', (req, res) => {
  const r = plivo.Response();
  if (false) { // need a way to detect call length; log arrives after this route is hit
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
    action: appUrl(`survey_result?q=rsvp&calleeUUID=${req.query.calleeUUID}&calleeNumber=${req.query.calleeNumber}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    validDigits: [1, 2, 3, 7, 9]
  });
  surveyResponse.addSpeakAU('Are they coming to the event? For "no", press 1. For "maybe", press 2. For "yes", press 3.');
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
    log_id: res.locals.log_id,
    caller_uuid: req.body.CallUUID,
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
    action: appUrl('log'),
    maxLength: 30,
    redirect: false
  });
  r.addSpeakAU('Thanks again for calling. We hope to see you again soon!');
  res.send(r.toXML());
});

const log = ({method, url, body, query, params, headers}, cb) => {
  if (method === 'GET') return cb();
  const UUID = body.CallUUID;
  Log.query().insert({UUID, url, body, query, params, headers}).nodeify(cb);
};

// already logged in middleware
app.post('/log', (req, res) => res.sendStatus(200));

module.exports = app;
