var express = require('express');
var plivo = require('plivo');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.set('port', (process.env.PORT || 5000));

app.all('/connect/', function(request, response) {
  var r = plivo.Response();
  if(request.method === 'GET'){
    var getdigits_action_url = request.protocol + '://' + request.headers.host + '/connect/';
    var params = {
      'action' : getdigits_action_url, // The URL to which the digits are sent
      'method' : 'POST', // Submit to action URL using GET or POST
      'timeout' : '5', // Time in seconds to wait to receive the first digit
      'numDigits' : '1', // Maximum number of digits to be processed in the current operation
      'retries' : '1' // Indicates the number of retries the user is allowed to input the digits
    };
    var getdigits = r.addGetDigits(params);
    getdigits.addSpeak('Press 1 to connect to another caller');
    r.addSpeak('No input received. Goodbye');
  } else {
    var digits = request.body.Digits;
    if (digits === '1'){
      r.addSpeak('Connecting your call');
      var d = r.addDial();
      d.addNumber('+61411653488'); // Rich's mobile
    } else {
      r.addSpeak('Invalid Digit');
    }
  }
  console.log (r.toXML());

  response.set({'Content-Type': 'text/xml'});
  response.send(r.toXML());
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
