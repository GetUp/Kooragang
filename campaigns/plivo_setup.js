const { get_callback_base_url, plivo_api } = require('../api/plivo')
const _ = require('lodash')
const { Campaign } = require('../models')
const { NoNumbersError } = require('../api/middleware/errors')
const { region_prefix_map, region_name_match, region_phone_type_match, plivo_number_search_strategy } = require('../utils')
const moment = require('moment')

const plivo_setup_campaigns = async () => {
  const campaigns_needing_inbound_setup = await Campaign.query().where({plivo_setup_status: 'needed'})
  await Promise.all(campaigns_needing_inbound_setup.map(setup_inbound))
  const campaigns_needing_outgoing_setup = await Campaign.query().where({plivo_setup_outgoing_status: 'needed'})
  await Promise.all(campaigns_needing_outgoing_setup.map(setup_outgoing))
}

//INBOUND
const setup_inbound = async (campaign) => {
  await campaign.$query().patch({plivo_setup_status: 'active'})
  if (!campaign.user_set_number && !campaign.phone_number) {
    await setup_inbound_infrastructure(campaign)
  } else {
    await campaign.$query().patch({plivo_setup_status: 'complete'})
  }
}

const setup_inbound_infrastructure = async (campaign) => {
  const callback_url = get_callback_base_url()
  const payload = {
    app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${campaign.id}-${campaign.name.replace(/\W/g, '_').toLowerCase()}_${moment().format('YYMMDDHHmm')}`,
    answer_url: `${callback_url}/connect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${callback_url}/log?event=fallback&campaign_id=${campaign.id}`,
    hangup_url: `${callback_url}/call_ended?campaign_id=${campaign.id}`
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

//OUTGOING
const setup_outgoing = async (campaign) => {
  await campaign.$query().patch({plivo_setup_outgoing_status: 'active'})
  if (!campaign.user_set_outgoing_number && !campaign.outgoing_number) {
    await setup_outgoing_infrastructure(campaign)
  } else {
    await campaign.$query().patch({plivo_setup_outgoing_status: 'complete'})
  }
}

const setup_outgoing_infrastructure = async (campaign) => {
  try {
    const outbound_number = await find_hangup_and_link_number(campaign.outgoing_number_region)
    await campaign.$query().patch({outgoing_number: outbound_number}).returning('*').first()
  } catch (e) {
    if (e instanceof NoNumbersError){
      await campaign.$query().patch({plivo_setup_outgoing_status: 'no_numbers_in_region'})
    }
    else {
      throw(e)
    }
  }
}

const find_hangup_and_link_number = async (region) => {
  const number = await find_free_number(region)
  await plivo_api('edit_number', {number, app_id: process.env.PLIVO_OUTGOING_HANGUP_APP_ID})
  return number
}

//SHARED
const find_free_number = async (region, offset=0) => {
  const batchSize = 20
  let search_response, number
  if (plivo_number_search_strategy() == 'number_prefix') {
    [search_response, number] = await find_free_number_by_number_prefix(region, batchSize, offset)
  } else {
    [search_response, number] = await find_free_number_by_region_name(region, batchSize, offset)
  }
  if (number) return number
  if (search_response.meta.next) {
    return find_free_number(region, offset+batchSize)
  } else {
    return await buy_number(region)
  }
}

const find_free_number_by_region_name = async (region, batchSize, offset) => {
  const number_search_params = {offset, limit: batchSize}
  const [_search_code, search_response] = await plivo_api('get_numbers', number_search_params, {multiArgs: true})
  const region_re = new RegExp(region, 'i')
  const number = _(search_response.objects)
    .filter(object => !object.application && object.region.match(region_re))
    .map('number')
    .first()
  return [search_response, number]
}

const find_free_number_by_number_prefix = async (region, batchSize, offset) => {
  const country_area_prefix = `${process.env.COUNTRY_CODE}${region_prefix_map(region)}`
  const number_search_params = {offset, limit: batchSize, number_startswith: country_area_prefix}
  const [_search_code, search_response] = await plivo_api('get_numbers', number_search_params, {multiArgs: true})

  const country_area_prefix_re = new RegExp('^' + country_area_prefix, 'i')
  const number = _(search_response.objects)
    .filter(object => !object.application && object.number.match(country_area_prefix_re))
    .map('number')
    .first()
  return [search_response, number]
}

const buy_number = async (region) => {
  const region_type = region_phone_type_match(region)
  let search_number_payload = {country_iso: process.env.COUNTRY_ISO, type: region_type} 

  if (plivo_number_search_strategy() == 'number_prefix') {
    const region_prefix = region_prefix_map(region)
    search_number_payload.pattern = region_prefix
  } else {
    const region_name = region_name_match(region)
    search_number_payload.region = region_name
  }

  const [_, number_search_response] = await plivo_api('search_phone_numbers', search_number_payload, {multiArgs: true})
  if (!number_search_response.objects.length) throw new NoNumbersError("No numbers available")
  await plivo_api('buy_phone_number', { number: number_search_response.objects[0].number }, {multiArgs: true})
  return number_search_response.objects[0].number
}

module.exports = {
  plivo_setup_campaigns,
  setup_inbound,
  setup_outgoing
}
