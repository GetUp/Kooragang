const express = require('express');
const app = express();
const {Log} = require('../models');
const plivo_validation = require('./middleware/plivo_validation')
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

app.use(async ({method, url, body, query, params, headers}, res, next) => {
  if (method === 'GET') return next();
  const UUID = body.CallUUID;
  if (process.env.NODE_ENV === 'development') console.error('REQUEST', {UUID, url, body})
  const log = await Log.query().insert({UUID, url, body, query, params, headers});
  res.locals.log_id = log.id;
  next();
});

app.post('/log', plivo_validation, (req, res) => res.sendStatus(200));

module.exports = app;
