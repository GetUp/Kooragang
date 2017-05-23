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
  app.use(require('./ivr/redirect'));
}

if (process.env.NODE_ENV === 'development' || !process.env.IVR || process.env.ADMIN) {
  // Session management
  const redis   = require("redis");
  const session = require('express-session');
  const redisStore = require('connect-redis')(session);
  const redisClient  = redis.createClient();
  const passport = require('passport');

  app.use(session({
    secret: process.env.SESSION_SECRET,
    // create new redis store.
    store: new redisStore({ host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379, client: redisClient, ttl :  260}),
    saveUninitialized: false,
    resave: false,
    signed: true
  }));

  // OAuth2
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(require('./auth/oauth2').router);
  app.use(require('./auth/oauth2').template);

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
