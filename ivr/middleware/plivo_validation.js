const app = require('express')()
require('dotenv').config()
const crypto = require('crypto')
const _ = require('lodash')
const { Event } = require('../../models')
const { ForbiddenError } = require("./errors")

const validate_signature = ({url, body, headers}) => {
  const sorted_body = _(body).toPairs().sortBy(0).fromPairs().value()
  const reduced_body = _.reduce(sorted_body, (result, value, key) => result.concat(key, value), _.stubString())
  const formed_uri = _.stubString().concat(process.env.BASE_URL, url, reduced_body)
  const generated_signature = crypto
    .createHmac('sha1', process.env.PLIVO_API_TOKEN)
    .update(formed_uri, 'utf-8')
    .digest('base64')
  return generated_signature === headers['x-plivo-signature']
}

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next()
  if (validate_signature(req)) return next()
  Event.query().insert({name: 'Plivo Request Signature Invalid'})
  return next(new ForbiddenError('Plivo Request Signature Invalid'))
})

module.exports = app
