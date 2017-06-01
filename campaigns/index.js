const app = require('express')();
const _ = require('lodash');
const {Campaign} = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

//PAGES
//dashboard
app.get('/dashboard', async ({body, params}, res) => {
  res.set('Content-Type', 'text/html');
  const campaigns = await Campaign.query();
  let campaignsArray = [];
  if (!campaigns) res.sendStatus(404);
  return res.render('dashboard.ejs', {campaigns})
});

//new
app.get('/campaigns/new', async (req, res) => {
  res.set('Content-Type', 'text/html');
  //if (!campaign) res.sendStatus(404);
  return res.render('edit.ejs', {})
})

//show
app.get('/campaigns/:id', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.params.id}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('show.ejs', {campaign})
})

//edit
app.get('/campaigns/:id/edit', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.params.id}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('edit.ejs', {campaign})
})

//API ENDPOINTS
//index
app.get('/campaigns', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const campaigns = await Campaign.query();
  return res.json(campaigns);
});

//create
app.post('/campaigns', async (req, res) => {
  req.accepts('json')
  try {
    const campaign = await Campaign.query().insert(req.body)
    return res.json({success: true});
  } catch (e) {
    console.log(e)
    return res.json({error: e});
  }
})

//update
app.put('/campaigns/:id', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.params.id}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('edit.ejs', {campaign})
})

//delete
app.delete('/campaigns/:id', async (req, res) => {
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: req.params.id}).first().delete();
  if (!campaign) res.sendStatus(404);
  return res.render('edit.ejs', {campaign})
})

module.exports = app
