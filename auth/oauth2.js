const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

function extractProfile (profile) {
  let imageUrl = '';
  if (profile.photos && profile.photos.length) {
    imageUrl = profile.photos[0].value;
  }
  return {
    id: profile.id,
    displayName: profile.displayName,
    image: imageUrl,
    email: profile.emails[0].value
  };
}

passport.use(new GoogleStrategy({
    clientID: process.env.OAUTH2_CLIENT_ID,
    clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    callbackURL: process.env.OAUTH2_CALLBACK,
    accessType: 'offline'
  }, (accessToken, refreshToken, profile, cb) => {
    cb(null, extractProfile(profile));
}));

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((obj, cb) => {
  cb(null, obj);
});

router.get('/auth/login', (req, res, next) => {
    if (req.query.return) {
      req.session.oauth2return = req.query.return;
    }
    next();
  },
  passport.authenticate('google', { scope: ['email', 'profile'], prompt: 'select_account' })
);

router.get('/auth/google/callback',
  passport.authenticate('google'),
  (req, res) => {
    var redirect = req.session.oauth2return || '/';
    delete req.session.oauth2return;

    const email = req.session.passport.user.email;
    if (email.split('@')[1] != process.env.PERMITTED_EMAIL_DOMAIN && process.env.PERMITTED_EMAILS.split(',').indexOf(email) < 0) {
      req.logout()
      redirect = '/auth/fail'
    }
    res.redirect(redirect);
  }
);

router.get('/auth/logout', (req, res) => {
  req.logout()
  res.redirect('/dashboard')
})

router.get('/auth/fail', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: "Login failed because your google account is not authorised. Perhaps try logging in to a different google account." }));
});

// Middleware that requires the user to be logged in. If the user is not logged
// in, it will redirect the user to authorize the application and then return
// them to the original URL they requested.
function authRequired (req, res, next) {
  if (!req.user) {
    req.session.oauth2return = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
}

// Middleware that exposes the user's profile as well as login/logout URLs to
// any templates. These are available as `profile`, `login`, and `logout`.
function addTemplateVariables (req, res, next) {
  res.locals.profile = req.user;
  res.locals.login = `/auth/login?return=${encodeURIComponent(req.originalUrl)}`;
  res.locals.logout = `/auth/logout?return=${encodeURIComponent(req.originalUrl)}`;
  next();
}

module.exports = {
  extractProfile: extractProfile,
  router: router,
  required: authRequired,
  template: addTemplateVariables
};
