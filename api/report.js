const app = require('express')()
const env = process.env.NODE_ENV || 'development'
const _ = require('lodash')
const moment = require('moment')
const config = require('../knexfile')   
const knex = require('knex')(config['read_only'][env])
const { Campaign, Call, Caller, Callee, Event, Team } = require('../models')
const { wrap } = require('./middleware')
const { BadRequestError, NotFoundError } = require("./middleware/errors")

//campaign report
app.get('/api/campaigns/:id/report', wrap(async (req, res, next) => {
}))

//teams report
app.get('/api/teams/:passcode/report', wrap(async (req, res, next) => {
}))

module.exports = app
