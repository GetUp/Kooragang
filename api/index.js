const app = require('express')()
const cors = require('cors')
const body_parser = require('body-parser')
const { cors_options, headers, authentication, log, error_handler } = require('./middleware')

if (process.env.NODE_ENV !== 'development') {
  const compression = require('compression')
  app.use(compression())
}

app.use(body_parser.json())
app.use(cors(cors_options))
app.use(headers)
app.use(log)
app.use(authentication)
app.use(require('./campaign'))
app.use(require('./team'))
app.use(require('./statistic'))
app.use(require('./report'))
app.use(error_handler)

module.exports = app
