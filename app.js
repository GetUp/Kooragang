/**
 * Module dependencies.
 */
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');
const sass = require('node-sass-middleware');

const Log = require('./models/Log');

/**
 * Controllers (route handlers).
 */
const ivrController = require('./controllers/ivr');
const campaignController = require('./controllers/campaign');
const userController = require('./controllers/user');

/**
 * API keys and Passport configuration.
 */
//const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();

/**
 * Express configuration.
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'))
app.set('port', process.env.PORT || 8080);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressStatusMonitor());
app.use(compression());
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public')
}));
app.use(expressValidator());

app.use((req, res, next) => {
  res.set('Content-Type', 'text/xml');
  next();
});
/*app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
    autoReconnect: true,
    clear_interval: 3600
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  if (req.path === '/api/upload') {
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
      req.path !== '/login' &&
      req.path !== '/signup' &&
      !req.path.match(/^\/auth/) &&
      !req.path.match(/\./)) {
    req.session.returnTo = req.path;
  } else if (req.user &&
      req.path == '/account') {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));*/

/**
 * Setup Logging
 */
const log = ({method, url, body, query, params, headers}, cb) => {
  if (method === 'GET') return cb();
  const UUID = body.CallUUID;
  if (process.env.NODE_ENV === 'development') console.error('REQUEST', {UUID, url, body})
  Log.query().insert({UUID, url, body, query, params, headers}).nodeify(cb);
};
app.use((req, res, next) => {
  if (req.method === 'GET') return next();
  log(req, (err, result) => {
    res.locals.log_id = result.id;
    next();
  });
});

/**
 * General routes.
 */
app.get('/', (req, res) => res.send('<_-.-_>I\'m awake.</_-.-_>'));

/**
 * IVR routes.
 */
app.post('/answer', ivrController.postAnswer);
app.post('/hangup', ivrController.postHangup);
app.post('/connect', ivrController.postConnect);
app.post('/ready', ivrController.postReady);
app.post('/call_ended', ivrController.postCallEnded);
app.post('/hold_music', ivrController.postHoldMusic);
app.post('/conference_event/callee', ivrController.postConferenceEventCallee);
app.post('/conference_event/caller', ivrController.postConferenceEventCaller);
app.post('/call_again', ivrController.postCallAgain);
app.post('/survey', ivrController.postSurvey);
app.post('/survey_result', ivrController.postSurveyResult);
app.post('/disconnect', ivrController.postDisconnect);
app.post('/feedback', ivrController.postFeedback);
app.post('/log', ivrController.postLog);
app.post('/fallback', ivrController.postFallback);
app.post('/callee_fallback', ivrController.postCalleeFallback);
app.post('/passcode', ivrController.postPasscode);
/**
 * Campaign routes.
 */
app.get('/stats/:id', campaignController.getStats);

/**
 * User app routes.
 */
/*app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
*/

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env')); 
});

module.exports = app;
