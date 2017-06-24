require('dotenv').config()
const ngrok = require('ngrok')
ngrok.connect({
  proto: 'http',
  addr: 5001,
  subdomain: process.env.NGROK_SUBDOMAIN,
  authtoken: process.env.NGROK_AUTH_TOKEN
}, function (err, url) {
  console.error(url)
});
ngrok.once('connect', function () {console.error("~ local tunnel connected")})
ngrok.once('disconnect', function () {console.error("~ local tunnel disconnected")})
ngrok.once('error', function () {console.error("~ local tunnel errored")})
