const port = process.env.PORT || 8080;
const app = require('express')();
if (process.env.NODE_ENV === 'development' || process.env.IVR) {
  app.use(require('./ivr/common'));
  app.use(require('./ivr/passcode'));
  app.use(require('./ivr/team'));
  app.use(require('./ivr/log'));
  app.use(require('./ivr/caller'));
  app.use(require('./ivr/callee'));
  app.use(require('./ivr/redirect'));
}
if (process.env.NODE_ENV === 'development' || !process.env.IVR) {
  app.use(require('./reports'));
  app.use(require('./campaigns/dashboard'));
  app.use(require('./teams/team'));
}
app.listen(port, () => console.log('App running on port', port));
