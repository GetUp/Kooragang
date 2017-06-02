const app = require('express')()
var api_config = require("./config");

app.use('/api/*', (err, req, res, next) => {
  console.log('!!!!!!!!')
  console.log(err.stack)
  return res.json({errors: e})
})

app.use('/api/*', (req, res, next) => {
  req.accepts('json')
  res.type('json')
  var token = req.body.token || req.query.token || req.headers['x-access-token']
  if (token) { 
    if (token === api_config.hash) {
      next();return
    } else {
      return res.json({ errors: 'Failed to authenticate token.' })
    }
  } else {
    return res.json({ errors: 'No authentication token provided.' })
  }
})

module.exports = app
