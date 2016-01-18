var plivo = require('plivo');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 5000));

// This file will be played when a caller presses 2.
var PLIVO_SONG = "https://s3.amazonaws.com/plivocloud/music.mp3";

// This is the message that Plivo reads when the caller dials in
var IVR_MESSAGE1 = "Welcome to the Plivo IVR Demo App. Press 1 to listen to a pre recorded text in different languages. Press 2 to listen to a song.";

var IVR_MESSAGE2 = "Press 1 for English. Press 2 for French. Press 3 for Russian";
// This is the message that Plivo reads when the caller does nothing at all
var NO_INPUT_MESSAGE = "Sorry, I didn't catch that. Please hangup and try again later.";

// This is the message that Plivo reads when the caller inputs a wrong number.
var WRONG_INPUT_MESSAGE = "Sorry, you've entered an invalid input.";

app.get('/response/ivr/', function(request, response) {
  var r = plivo.Response();
  var getdigits_action_url, params, getDigits;
  getdigits_action_url = request.protocol + '://' + request.headers.host + '/response/ivr/';
  params = {
    'action': getdigits_action_url,
    'method': 'POST',
    'timeout': '7',
    'numDigits': '1',
    'retries': '1'
  };
  getDigits = r.addGetDigits(params);
  getDigits.addSpeak(IVR_MESSAGE1);
  r.addSpeak(NO_INPUT_MESSAGE);

  console.log(r.toXML());
  response.set({'Content-Type': 'text/xml'});
  response.send(r.toXML());
});

app.post('/response/ivr/', function(request, response) {
  var r = plivo.Response();
  var getdigits_action_url, params, getDigits;
  var digit = request.body.Digits;
  console.log(digit);
  if (digit === '1') {
    getdigits_action_url = request.protocol + '://' + request.headers.host + '/response/tree/';
    params = {
      'action': getdigits_action_url,
      'method': 'POST',
      'timeout': '7',
      'numDigits': '1',
      'retries': '1'
    };
    getDigits = r.addGetDigits(params);
    getDigits.addSpeak(IVR_MESSAGE2);
    r.addSpeak(NO_INPUT_MESSAGE);
  } else if (digit === '2') {
    r.addPlay(PLIVO_SONG);
  } else {
    r.addSpeak("POST route message");
  }

  console.log(r.toXML());
  response.set({'Content-Type': 'text/xml'});
  response.send(r.toXML());
});

app.all('/response/tree/', function(request, response) {
  var r = plivo.Response();
  var text, params;
  var digit = request.body.Digits || request.query.Digits;
  if (digit === "1") {
    text = "Ce message est lu en français";
    params = {'language': 'fr-FR'};
    r.addSpeak(text, params);
  } else if (digit === "2") {
    text = "Ce message est lu en français";
    params = {'language': 'fr-FR'};
    r.addSpeak(text, params);
  } else if (digit === "3") {
    text = "Это сообщение было прочитано в России";
    params = {'language': 'ru-RU'};
    r.addSpeak(text, params);
  } else {
    r.addSpeak("ALL route message");
  }

  console.log(r.toXML());
  response.set({'Content-Type': 'text/xml'});
  response.send(r.toXML());
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
