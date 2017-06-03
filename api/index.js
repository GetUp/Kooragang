const app = require('express')()
const { headers, authentication, log, error_handler } = require('./middleware')

if (process.env.NODE_ENV !== 'development') {
	const compression = require('compression')
	app.use(compression())
}

app.use(headers)
app.use(authentication)
app.use(require('./campaign'))
app.use(require('./team'))
app.use(require('./report'))
app.use(log)
app.use(error_handler)

module.exports = app
