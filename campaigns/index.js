const app = require('express')();
const _ = require('lodash');
const {Campaign} = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

//PAGES
//dashboard
app.get('/campaigns/dashboard', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaigns = await Campaign.query();
  let campaignsArray = [];
  if (!campaigns) res.sendStatus(404);
  return res.render('dashboard.ejs', {campaigns})
});

//new
app.get('/campaigns/new', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const env = process.env.NODE_ENV
  return res.render('campaign.ejs', {env})
})

//show
app.get('/campaigns/:id', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const env = process.env.NODE_ENV
  return res.render('campaign.ejs', {env})
})

//edit
app.get('/campaigns/:id/edit', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const env = process.env.NODE_ENV
  return res.render('campaign.ejs', {env})
})

module.exports = app
