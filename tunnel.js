require('dotenv').config()
const ngrok = require('ngrok')
ngrok.connect({
  proto: 'http',
  addr: 5000,
  subdomain: process.env.NGROK_SUBDOMAIN,
  authtoken: process.env.NGROK_AUTH_TOKEN
}, function (err, url) {
  console.warn(url)
})
ngrok.once('connect', function () {console.warn("~ local tunnel connected")})
ngrok.once('disconnect', function () {console.warn("~ local tunnel disconnected")})
ngrok.once('error', function () {console.error("~ local tunnel errored")})
