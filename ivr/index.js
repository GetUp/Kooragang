const app = require('express')()
app.use(require('./common'))
app.use(require('./log'))
app.use(require('./passcode'))
app.use(require('./team'))
app.use(require('./caller'))
app.use(require('./callee'))
app.use(require('./redirect'))
module.exports = app
