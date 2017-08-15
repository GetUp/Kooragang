const { plivo_api } = require('../api/plivo')
const { Campaign } = require('../models')
const _ = require('lodash')

const setup_inbound = async (campaign) => {
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${campaign.name.replace(/\W/g, '_').toLowerCase()}`,
    answer_url: `${base_url}/connect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/call_ended?campaign_id=${campaign.id}`
  }
  const inbound_number = await create_app_and_link_number(payload, campaign.number_region)
  return await campaign.$query().patch({phone_number: inbound_number}).returning('*').first()
}

const setup_redirect = async (campaign) => {
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${campaign.name.replace(/\W/g, '_').toLowerCase()}-redirect`,
    answer_url: `${base_url}/redirect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=redirect_fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/log?event=redirect_hangup&campaign_id=${campaign.id}`
  }
  const redirect_number = await create_app_and_link_number(payload, campaign.number_region)
  return await campaign.$query().patch({redirect_number}).returning('*').first()
}

const create_app_and_link_number = async (payload, region='Sydney') => {
  const number_options = { type: 'fixed', country_iso: process.env.PLIVO_COUNTRY_ISO, region}
  const [create_code, create_response] = await plivo_api('create_application', payload, {multiArgs: true})
  const app_id = create_response.app_id
  const number = await find_free_number(region)
  await plivo_api('edit_number', {number, app_id})
  return number
}

const find_free_number = async (region, offset=0) => {
  const batchSize = 20
  const [search_code, search_response] = await plivo_api('get_numbers', {offset, limit: batchSize}, {multiArgs: true})
  const region_re = new RegExp(region, 'i')
  const number = _(search_response.objects)
    .filter(object => !object.application && object.region.match(region_re))
    .map('number')
    .first()
  if (number) return number
  if (search_response.meta.next) {
    return find_free_number(region, offset+batchSize)
  } else {
    throw new Error("No numbers available")
  }
}

module.exports = {
  setup_inbound,
  setup_redirect
}
