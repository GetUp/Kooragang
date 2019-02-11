const app = require('express')()
const { Campaign, Caller, Audience } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")
const { plivo_api } = require('./plivo')
const { callerCallParams } = require('../dialer')
const host = process.env.BASE_URL

//index
app.get('/api/campaigns', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().orderBy('created_at', 'desc')
  if (!campaign) return next(new NotFoundError('No Campaigns Exist'))
  return res.json({data: campaign})
}))

//index public
app.get('/api/campaigns_public', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({status: 'active', public_visible: true}).orderBy('created_at', 'desc')
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
  let payload = req.body.data
  payload.plivo_setup_status = 'needed'
  let campaign = await Campaign.query().insert(payload).returning('*').first()
  if (!campaign) return next(new BadRequestError('No Campaign Created'))
  return res.json({data: campaign})
}))

//update
app.put('/api/campaigns/:id', wrap(async (req, res, next) => {
  let payload = req.body.data
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  const updated_campaign = await campaign.update_and_patch_jobs(payload)
  return res.json({data: updated_campaign})
}))

//delete
app.delete('/api/campaigns/:id', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  const non_assessment_callers = await Caller.query().where({campaign_id: campaign.id, test: false}).count().first()
  const non_assessment_callers_int = non_assessment_callers ? parseInt(non_assessment_callers.count, 10) : 0;
  if (non_assessment_callers_int > 0) return next(new BadRequestError('Cannot Delete Campaign With ID: ' + req.params.id))
  await Audience.query().where({campaign_id: campaign.id}).delete()
  if (await campaign.$query().delete()) return res.json({data: campaign})
  return next(new BadRequestError('Campaign Was Not Deleted'))
}))

//text_to_speech
app.post('/api/campaigns/:id/text_to_speech', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  if (await campaign.text_to_speech()) return res.json({data: campaign})
  return next(new BadRequestError('Campaign Text To Speech Did Not Happen'))
}))

//clone campaign
app.post('/api/campaigns/:id/clone', wrap(async (req, res, next) => {
  const payload = req.body.data
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  const cloned_campaign = await campaign.insert_clone(payload)
  if (cloned_campaign) return res.json({data: cloned_campaign})
  return next(new BadRequestError('Campaign did not clone'))
}))

//assessment call
app.post('/api/campaigns/:id/assessment', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  if (!req.body.data.mobile_number) return next(new BadRequestError('No Phone Number'))
  const mobile = req.body.data.mobile_number.replace(/^0/, '61')
  await plivo_api('make_call', callerCallParams(campaign, mobile, host, 1))
  return res.json({data: req.params.id})
}))

//get campaign audiences
app.get('/api/campaigns/:id/audiences', wrap(async (req, res, next) => {
  const campaign = await Campaign.query().where({id: req.params.id}).first()
  if (!campaign) return next(new NotFoundError('No Campaign Exists With ID: ' + req.params.id))
  const audiences = await Audience.query().where({campaign_id: campaign.id})
  return res.json({data: audiences})
}))

module.exports = app
