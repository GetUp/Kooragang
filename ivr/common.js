/* eslint no-control-regex: 0 */

const app = require('express')();
const plivo = require('plivo');
const bodyParser = require('body-parser');
const { plivo_signature } = require('../api/plivo')

app.use(bodyParser.urlencoded({extended: true}));

const response = Object.getPrototypeOf(plivo.Response());
response.addSpeakAU = function(text) {
  text = text.replace(/[^\x00-\x7F]/g, "");//stripping non UTF8 chars
  this.addSpeak(text, {language: 'en-US', voice: 'MAN'});
};

app.use((req, res, next) => {
  const host= process.env.BASE_URL || `${req.protocol}://${req.hostname}`;
  res.locals.appUrl = endpoint => endpoint ? `${host}/${endpoint}` : host;
  res.set('Content-Type', 'text/xml');
  next();
});

app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'));

if (!process.env.DISABLE_PLIVO_SECURITY) app.use(plivo_signature)

module.exports = app;
