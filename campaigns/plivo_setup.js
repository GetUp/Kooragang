const { plivo_api } = require('../api/plivo')
const _ = require('lodash')
const { Campaign } = require('../models')
const { NoNumbersError } = require('../api/middleware/errors')
const { region_prefix_map } = require('../utils')
const moment = require('moment')

const plivo_setup_campaigns = async () => {
  const campaigns = await Campaign.query().where({plivo_setup_status: 'needed'})
  await Promise.all(campaigns.map(setup))
}

const setup = async (campaign) => {
  await campaign.$query().patch({plivo_setup_status: 'active'})
  if (!campaign.phone_number) {
    await setup_inbound(campaign)
    //await setup_redirect(campaign)
  } else { 
    await campaign.$query().patch({plivo_setup_status: 'complete'})
  }
}

const setup_redirect = async (campaign) => {
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `${moment().format('x')}_kooragang-${process.env.NODE_ENV || 'development'}-${campaign.id}-${campaign.name.replace(/\W/g, '_').toLowerCase()}-redirect`,
    answer_url: `${base_url}/redirect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=redirect_fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/log?event=redirect_hangup&campaign_id=${campaign.id}`
  }
  try {
    const redirect_number = await create_app_and_link_number(payload, campaign.number_region)
    await campaign.$query().patch({redirect_number: redirect_number}).returning('*').first()
  } catch (e) {
    if (e instanceof NoNumbersError){
      await campaign.$query().patch({plivo_setup_status: 'no_numbers_in_region'})
    }
    else {
      throw(e)
    }
  }
}

const setup_inbound = async (campaign) => {
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `${moment().format('x')}_kooragang-${process.env.NODE_ENV || 'development'}-${campaign.id}-${campaign.name.replace(/\W/g, '_').toLowerCase()}`,
    answer_url: `${base_url}/connect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/call_ended?campaign_id=${campaign.id}`
  }
  try {
    const inbound_number = await create_app_and_link_number(payload, campaign.number_region)
    await campaign.$query().patch({phone_number: inbound_number, plivo_setup_status: 'complete'}).returning('*').first()
  } catch (e) {
    if (e instanceof NoNumbersError){
      await campaign.$query().patch({plivo_setup_status: 'no_numbers_in_region'})
    }
    else {
      throw(e)
    }
  }
}

const create_app_and_link_number = async (payload, region) => {
  const number = await find_free_number(region)
  const [_create_code, create_response] = await plivo_api('create_application', payload, {multiArgs: true})
  await plivo_api('edit_number', {number, app_id: create_response.app_id})
  return number
}

const find_free_number = async (region, offset=0) => {
  const country_area_prefix = `${process.env.COUNTRY_CODE}${region_prefix_map(region)}`
  const batchSize = 20
  const [_search_code, search_response] = await plivo_api('get_numbers', {number_startswith: country_area_prefix, offset, limit: batchSize}, {multiArgs: true})
  const country_area_prefix_re = new RegExp('^' + country_area_prefix, 'i')
  const number = _(search_response.objects)
    .filter(object => !object.application && object.number.match(country_area_prefix_re))
    .map('number')
    .first()
  if (number) return number
  if (search_response.meta.next) {
    return find_free_number(region, offset+batchSize)
  } else {
    return await buy_number(region)
  }
}

const buy_number = async (region) => {
  const region_prefix = region_prefix_map(region)
  const search_number_payload = {country_iso: process.env.COUNTRY_ISO, pattern: region_prefix, type: 'fixed'}
  const [number_search_code, number_search_response] = await plivo_api('search_phone_numbers', search_number_payload, {multiArgs: true})
  if (!number_search_response.objects || !number_search_response.objects.length) throw new NoNumbersError("No numbers available")
  const [number_buy_code, number_buy_response] = await plivo_api('buy_phone_number', { number: number_search_response.objects[0].number }, {multiArgs: true})
  return number_search_response.objects[0].number
}

module.exports = {
  plivo_setup_campaigns,
  setup
}
