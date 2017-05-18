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

app.get('/campaigns/:id/edit', async ({body, params, user}, res) => {
  if (!user) res.redirect('/auth/login') 
  res.set('Content-Type', 'text/html');
  const campaign = await Campaign.query().where({id: params.id}).first();
  if (!campaign) res.sendStatus(404);
  return res.render('edit.ejs', {campaign})
})

app.post('/campaigns/:id', async ({body, params, user}, res) => {
  if (!user) res.redirect('/auth/login')

  var campaign = await Campaign.query().where({id: params.id}).first();
  if (!campaign) res.sendStatus(404);
  campaign_params = _.pick(body, ['name', 'status', 'script_url', 'phone_number', 'daily_start_operation', 'daily_stop_operation','detect_answering_machine','max_ratio', 'ratio_window', 'ratio_increment', 'max_call_attempts', 'no_call_window', 'exhaust_callees_before_recycling', 'custom_dialogue']);

  campaign_params.more_info = JSON.parse(body.more_info)
  campaign_params.questions = JSON.parse(body.questions)
  campaign_params.custom_dialogue = JSON.parse(body.custom_dialogue)

  campaign = await Campaign.query().patchAndFetchById(campaign.id, campaign_params)
  res.redirect('/dashboard')
})

// app.get('/campaigns/:id/clone', async ({body, params}, res) => {
//   var campaign = await Campaign.query().where({id: params.id}).first();
//   campaign.id = null;
//   var d = await Campaign.query().insert(campaign)
//   console.log(d)
//   res.redirect('/campaigns/' + new_campaign.id + '/edit')  
// })


module.exports = app
