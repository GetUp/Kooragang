const api = require('../api')
const { Campaign } = require('../models');

module.exports = async (fields, area) => {
  const campaign = await Campaign.query().insert(fields);
  const base_url = process.env.BASE_URL || 'https://test'
  const payload = {
    app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${fields.name.replace(/\W/g, '_').toLowerCase()}`,
    answer_url: `${base_url}/connect?campaign_id=${campaign.id}`,
    fallback_answer_url: `${base_url}/log?event=fallback&campaign_id=${campaign.id}`,
    hangup_url: `${base_url}/call_ended?campaign_id=${campaign.id}`
  }
  const [code1, res1] = await api('create_application', payload, {multiArgs: true})
  const app_id = res1.app_id
  const [code2, res2] = await api('search_phone_numbers', area, {multiArgs: true})
  if (!res2.objects.length) throw new Error("No numbers available")
  const number = res2.objects[0].number
  await api('buy_phone_number', {number, app_id})
  let updated_campaign = await campaign.$query().patch({phone_number: number}).returning('*').first()

  if (campaign.target_number) {
    if (!res2.objects.length === 1) throw new Error("Not enough numbers available")
    const redirect_number = res2.objects[1].number
    const redirect_payload = {
      app_name: `kooragang-${process.env.NODE_ENV || 'development'}-${fields.name.replace(/\W/g, '_').toLowerCase()}-redirect`,
      answer_url: `${base_url}/redirect?campaign_id=${campaign.id}`,
      fallback_answer_url: `${base_url}/log?event=redirect_fallback&campaign_id=${campaign.id}`,
      hangup_url: `${base_url}/log?event=redirect_hangup&campaign_id=${campaign.id}`
    }
    const [code3, res4] = await api('create_application', redirect_payload, {multiArgs: true})
    const redirect_app_id = res4.app_id
    await api('buy_phone_number', {number: redirect_number, app_id: redirect_app_id})
    updated_campaign = await campaign.$query().patch({redirect_number}).returning('*').first()
  }
  return updated_campaign;
}
