/* eslint comma-dangle: 0 */
const _ = require('lodash')

const campaign = {
  id: 1,
  name: 'Predictive Dialler Test',
  phone_number: '61285994346',
  dialer: 'ratio',
  status: 'active',
  ratio: 1,
  max_ratio: 1,
  questions: require('./questions.example.json'),
  more_info: require('./more_info.example.json'),
  script_url: 'https://docs.google.com/document/d/1_2uhubfXoW8zokuhKXdRAdz8_WMH7R0wAQM5YWZii-4/pub?embedded=true',
}
const robin = { first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1 }
const callees = _.times(60, _.constant(robin))

const tim = { first_name: 'Tim', phone_number: '61413877188', location: 'Omnipresent', campaign_id: 1 }
const skype = { first_name: 'Skype', phone_number: 'anonymous', location: 'the Information Super Highway', campaign_id: 1 }
const bridger = { first_name: 'Bridger', phone_number: 'bridger170216043416', location: 'Newcastle', campaign_id: 1 }
const callers = [tim, skype, bridger]

exports.seed = (knex, Promise) =>
  Promise.join(
    knex('events').del(),
    knex('calls').del(),
    knex('callees').del(),
    knex('callers').del(),
    knex('campaigns').del(),
    knex('campaigns').insert(campaign),
    knex('callees').insert(callees),
    knex('callers').insert(callers)
  )
