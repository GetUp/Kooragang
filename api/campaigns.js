const app = require('express')()
const { Campaign } = require('../models')

//index
app.get('/api/campaigns', async (req, res) => {
  const campaign = await Campaign.query()
  if (!campaign) throw 'No Campagin Created'
  return res.json({data: campaign})
})

//show
app.get('/api/campaigns/:id', async (req, res) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) throw 'No Campagin Exists With ID: ' + req.params.id
  return res.json({data: campaign})
})

//create
app.post('/api/campaigns', async (req, res) => {
  const campaign = await Campaign.query().insert(req.body.data)
  if (!campaign) throw 'No Campagin Created'
  return res.json({data: campaign})
})

//update
app.put('/api/campaigns/:id', async (req, res) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) throw 'No Campagin Exists With ID: ' + req.params.id
  campaign.$query().patch(req.body.data)
  return res.json({data: campaign})
})

//delete
app.delete('/api/campaigns/:id', async (req, res) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) throw 'No Campagin Exists With ID: ' + req.params.id
  campaign.$query().delete()
  if (campaign) throw 'Campagin Was Not Deleted'
  return res.json({data: campaign})
})

module.exports = app;
