const app = require('express')()

app.use(require('./middleware'))
app.use(require('./campaigns'))
app.use(require('./teams'))
app.use(require('./reports'))

module.exports = app
