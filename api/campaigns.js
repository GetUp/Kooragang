const app = require('express')()
const { Campaign } = require('../models')

//index
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaign = await Campaign.query()
  	if (!campaign) throw 'No Campagin Created'
    return res.json({data: campaign})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//show
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
  	if (!campaign) throw 'No Campagin Exists With ID: ${req.params.id}'
    return res.json({data: campaign})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//create
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaign = await Campaign.query().insert(req.body.data)
  	if (!campaign) throw 'No Campagin Created'
    return res.json({data: campaign})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//update
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
    if (!campaign) throw 'No Campagin Exists With ID: ${req.params.id}'
   	campaign.$query().patch(req.body.data)
    return res.json({data: campaign})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//delete
app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.query().where({id: req.params.id}).first()
    if (!campaign) throw 'No Campagin Exists With ID: ${req.params.id}'
    campaign.$query().delete()
    if (campaign) throw 'Campagin Was Not Deleted'
    return res.json({data: campaign})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

module.exports = app;
