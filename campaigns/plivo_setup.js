const { plivo_api } = require('../api/plivo')
const { Campaign } = require('../models')

const setup_inbound = async (campaign) => {
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${campaign.name.replace(/\W/g, '_').toLowerCase()}`,
    answer_url: `${base_url}/connect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/call_ended?campaign_id=${campaign.id}`
  }
  const inbound_number = await create_app_and_buy_number(payload, campaign.number_region)
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
  const redirect_number = await create_app_and_buy_number(payload, campaign.number_region)
  return await campaign.$query().patch({redirect_number}).returning('*').first()
}

const create_app_and_buy_number = async (payload, region='Sydney') => {
  const number_options = { type: 'fixed', country_iso: process.env.PLIVO_COUNTRY_ISO, region}
  const [create_code, create_response] = await plivo_api('create_application', payload, {multiArgs: true})
  const app_id = create_response.app_id
  const [search_code, search_response] = await plivo_api('search_phone_numbers', number_options, {multiArgs: true})
  if (!search_response.objects) throw new Error("Incorrect region string")
  if (!search_response.objects.length) throw new Error("No numbers available")
  const number = search_response.objects[0].number
  await plivo_api('buy_phone_number', {number, app_id})
  return number
}

module.exports = {
  setup_inbound,
  setup_redirect
}
