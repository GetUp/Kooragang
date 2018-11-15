require('newrelic')
const port = process.env.PORT || 8080
const app = require('express')()
if (process.env.IVR) {
  app.use(require('./ivr'))
}
if (process.env.API) {
  app.use(require('./api'))
}
const server = app.listen(port, () => console.log('App running on port', port))

if (process.env.HUD) {
  require('./hud')(server)
}
