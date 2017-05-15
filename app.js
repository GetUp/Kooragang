const port = process.env.PORT || 8080;
const app = require('express')();
const bodyParser = require('body-parser');

if (process.env.NODE_ENV === 'development' || process.env.IVR) {
  app.use(require('./ivr/common'));
  app.use(require('./ivr/passcode'));
  app.use(require('./ivr/team'));
  app.use(require('./ivr/log'));
  app.use(require('./ivr/caller'));
  app.use(require('./ivr/callee'));
}
if (process.env.NODE_ENV === 'development' || !process.env.IVR) {
  app.set('view engine', 'ejs');
  app.use(require('express-ejs-layouts'))
  app.set('layout', __dirname + '/layouts/layout');
  app.use( bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));   
  app.use(require('./reports'));
  app.use(require('./campaigns/dashboard'));
  app.use(require('./teams/team'));
}
app.listen(port, () => console.log('App running on port', port));
