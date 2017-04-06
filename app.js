const app = require('express')();
const port = process.env.PORT || 8080;
app.use(require('./ivr/common'));
app.use(require('./ivr/passcode'));
app.use(require('./ivr/log'));
app.use(require('./ivr/caller'));
app.use(require('./ivr/callee'));
app.use(require('./reports'));
app.listen(port, () => console.log('App running on port', port));
