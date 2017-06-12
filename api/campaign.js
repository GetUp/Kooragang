const app = require('express')()
const { Campaign } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")
const { setup_inbound, setup_redirect } = require("../campaigns/plivo_setup")

//index
app.get('/api/campaigns', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().orderBy('created_at', 'desc')
  if (!campaign) return next(new NotFoundError('No Campaigns Exist'))
  return res.json({data: campaign})
}))

//show
app.get('/api/campaigns/:id', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  return res.json({data: campaign})
}))

//create
app.post('/api/campaigns', wrap(async (req, res, next) => {
  console.log(req.body.data)
  let campaign = await Campaign.query().insert(req.body.data)
  if (!campaign) return next(new BadRequestError('No Campaign Created'))
  if (!campaign.phone_number) campaign = await setup_inbound(campaign)
  if (!campaign.redirect_number && campaign.target_number) campaign = await setup_redirect(campaign)
  return res.json({data: campaign})
}))

//update
app.put('/api/campaigns/:id', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  await campaign.$query().patch(req.body.data)
  return res.json({data: campaign})
}))

//delete
app.delete('/api/campaigns/:id', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  if (await campaign.$query().delete()) return res.json({data: campaign})
  return next(new BadRequestError('Campaign Was Not Deleted'))
}))

module.exports = app
