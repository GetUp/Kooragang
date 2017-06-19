const app = require('express')()
const { Team } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")

//index
app.get('/api/teams', wrap(async (req, res, next) => {
  const team = await Team.query().orderBy('created_at', 'desc')
  if (!team) return next(new NotFoundError('No Teams Exist'))
  return res.json({data: team})
}))

//show
app.get('/api/teams/:id', wrap(async (req, res, next) => {
  const team = await Team.query().where({id: req.params.id}).first()
  if (!team) return next(new NotFoundError('No Team Exists With ID: ' + req.params.id))
  return res.json({data: team})
}))

//create
app.post('/api/teams', wrap(async (req, res, next) => {
  const team = await Team.query().insert(req.body.data)
  if (!team) return next(new BadRequestError('No Team Created'))
  return res.json({data: team})
}))

//update
app.put('/api/teams/:id', wrap(async (req, res, next) => {
  const team = await Team.query().where({id: req.params.id}).first()
  if (!team) return next(new NotFoundError('No Team Exists With ID: ' + req.params.id))
  await team.$query().patch(req.body.data)
  return res.json({data: team})
}))

//delete
app.delete('/api/teams/:id', wrap(async (req, res, next) => {
  const team = await Team.query().where({id: req.params.id}).first()
  if (!team) return next(new NotFoundError('No Team Exists With ID: ' + req.params.id))
  if (await team.$query().delete()) return res.json({data: team})
  return next(new BadRequestError('Team Was Not Deleted'))
}))

module.exports = app
