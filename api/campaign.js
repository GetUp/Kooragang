const app = require('express')()
const { Campaign } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")

//index
app.get('/api/campaigns', wrap(async (req, res, next) => {
  const campaign = await Campaign.query()
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
  const campaign = await Campaign.query().insert(req.body.data)
  if (!campaign) return next(new BadRequestError('No Campaign Created'))
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
