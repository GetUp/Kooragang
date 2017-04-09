const app = require('express')();
const _ = require('lodash');
const {Campaign} = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.get('/dashboard', async ({body, params}, res) => {
  res.set('Content-Type', 'text/html');
  const campaigns = await Campaign.query();
  let campaignsArray = [];
  if (!campaigns) res.sendStatus(404);
  return res.render('dashboard.ejs', {campaigns})
});


module.exports = app
