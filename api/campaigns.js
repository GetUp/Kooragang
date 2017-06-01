const app = require('express')()
const _ = require('lodash')
const {Campaign} = require('../models')

//API ENDPOINTS
//index
app.get('/api/campaigns', async (req, res) => {
  req.accepts('json')
  res.set('Content-Type', 'application/json')
  try {
    const campaign = await Campaign.query()
  	if (!campaign) throw 'No Campagin Created'
    return res.json(campaign)
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//show
app.get('/api/campaigns/:id', async (req, res) => {
  req.accepts('json')
  res.set('Content-Type', 'application/json')
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
  	if (!campaign) throw 'No Campagin Exists'
    return res.json(campaign)
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//create
app.post('/api/campaigns', async (req, res) => {
  req.accepts('json')
  res.set('Content-Type', 'application/json')
  try {
    const campaign = await Campaign.query().insert(req.body)
  	if (!campaign) throw 'No Campagin Created'
    return res.json(campaign)
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//update
app.put('/api/campaigns/:id', async (req, res) => {
  req.accepts('json')
  res.set('Content-Type', 'application/json')
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
    return res.json(campaign)
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//delete
app.delete('/api/campaigns/:id', async (req, res) => {
  req.accepts('json')
  res.set('Content-Type', 'application/json')
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
    campaign.$query().delete()
    if (campaign) throw 'Campagin Was Not Deleted'
    return res.json(campaign)
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

module.exports = app;