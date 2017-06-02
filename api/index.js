const app = require('express')()
app.use('/api/*', (req, res, next) => {
  req.accepts('json')
  res.type('json')
  next()
})
app.use(require('./campaigns'))
app.use(require('./teams'))
app.use(require('./redirects'))
app.use(require('./survey_results'))
app.use(require('./reports'))
module.exports = app
