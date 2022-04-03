/* eslint no-control-regex: 0 */

const app = require('express')()
const plivo = require('plivo')
const bodyParser = require('body-parser')
const { get_callback_base_url, plivo_signature } = require('../api/plivo')
const { languageBlock } = require('../utils')
const voice = require('./voice')

app.use(bodyParser.urlencoded({extended: true}))

const response = Object.getPrototypeOf(plivo.Response())
response.addSpeakLanguage = function(text) {
  text = text.replace(/[^\x00-\x7F]/g, "")//stripping non UTF8 chars
  this.addSpeak(text, voice())
}

response.addSpeakI18n = function(block, vars) {
  let text = languageBlock(block, vars)
  text = text.replace(/[^\x00-\x7F]/g, "")//stripping non UTF8 chars
  this.addSpeak(text, voice())
}

app.use((req, res, next) => {
  const host = get_callback_base_url() || `${req.protocol}://${req.hostname}`
  res.locals.plivoCallbackUrl = endpoint => endpoint ? `${host}/${endpoint}` : host
  res.set('Content-Type', 'text/xml')
  next()
})

app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'))

if (!process.env.DISABLE_PLIVO_SECURITY) app.use(plivo_signature)

module.exports = app
