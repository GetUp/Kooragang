if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')
const port = process.env.PORT || 8080
const app = require('express')()
if (process.env.IVR) {
  app.use(require('./ivr'))
}
if (process.env.API) {
  app.use(require('./api'))
}
if (process.env.HUD) {
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Headers', 'X-Requested-With')
    console.log(`~~~~~~> Using Cors Headers For Response ${res}`)
    return next()
  })
}
const server = app.listen(port, () => console.log('App running on port', port))
if (process.env.HUD) {
  require('./hud')(server)
}

