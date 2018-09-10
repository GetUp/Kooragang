const app = require('express')()
const plivo = require('plivo')
const _ = require('lodash')
const {Caller, Campaign} = require('../models')
const { languageBlock } = require('../utils')
const storage = require('node-persist')

app.post('/survey_assessment', async ({query, body}, res) => {
  const r = plivo.Response()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const questions = campaign.questions
  const question = query.q
  const caller_id = query.caller_id
  const questionData = questions[question]
  const assessment = query.assessment ? query.assessment === "1" : false
  const surveyResponse = r.addGetDigits({
    action: res.locals.appUrl(`survey_result_assessment?q=${question}&caller_id=${caller_id}&campaign_id=${query.campaign_id}&assessment=1`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: Object.keys(questionData.answers),
  })
  surveyResponse.addSpeakI18n('_transparent', {var: questionData.name})
  surveyResponse.addWait({length: 5})
  surveyResponse.addSpeakI18n('survey_iphone_help')
  res.send(r.toXML())
})

app.post('/survey_result_assessment', async ({query, body}, res) => {
  const r = plivo.Response()
  const caller = await Caller.query().where({id: query.caller_id}).first()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const questions = campaign.questions
  const question = questions[query.q]
  const disposition = question.answers[body.Digits || query.digit].value
  const next = question.answers[body.Digits || query.digit].next
  const answers = question.answers

  if (query.multiple === 1 && (body.Digits  === '*' || query.digit  === '*')) {
    console.log('@@@@@@@@@@@@')
    if (next) {
      r.addRedirect(res.locals.appUrl(`survey_assessment?q=${next}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&assessment=1`))
    } else {
      r.addSpeakI18n('end_assessment_survey')
      r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1&callback=0&authenticated=${query.authenticated ? '1' : '0'}&assessment=1`))
    }
  }

  r.addSpeakI18n('_transparent', {var: disposition})

  const type = question.type
  const deliver = question.answers[body.Digits || query.digit].deliver
  if (type === 'SMS' && deliver) {
    const content = question.answers[body.Digits || query.digit].content
    r.addMessage(`${content}`, {
      src: campaign.sms_number || process.env.NUMBER || '1111111111',
      dst: caller.phone_number
    })
  }

  await storage.init({
    ttl: '10000',
    expiredInterval: 2 * 60 * 1000
  });
  const response_cache_key = `assessment_responses_caller_${caller.id}_question_${query.q}`
  const previous_survey_results = await storage.getItem(response_cache_key)
  const responses = previous_survey_results ? previous_survey_results.push(disposition) : [disposition]
  await storage.setItem(response_cache_key,responses)
  const current_survey_results = await storage.getItem(response_cache_key)
  console.log(`current ~~~ ${response_cache_key}`)

  if (query.q != 'disposition' && question.multiple && current_survey_results.length < Object.keys(answers).length) {
    r.addRedirect(res.locals.appUrl(`survey_multiple_assessment?q=${query.q}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}`))
    return res.send(r.toXML())
  }

  await storage.removeItem(
    `assessment_responses_caller_${caller.id}_question_${question}`
  ) 

  if (next) {
    r.addRedirect(res.locals.appUrl(`survey_assessment?q=${next}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&assessment=1`))
  } else {
    r.addSpeakI18n('end_assessment_survey')
    r.addRedirect(res.locals.appUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1&callback=0&authenticated=${query.authenticated ? '1' : '0'}&assessment=1`))
  }
  res.send(r.toXML())
})

app.post('/survey_multiple_assessment', async ({query, body}, res) => {
  const r = plivo.Response()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const caller = await Caller.query().where({id: query.caller_id}).first()
  const questions = campaign.questions
  const question = query.q
  const questionData = questions[question]
  await storage.init({
    ttl: '10000',
    expiredInterval: 2 * 60 * 1000
  });
  const response_cache_key = `assessment_responses_caller_${caller.id}_question_${query.q}`
  const previous_survey_result_answers = await storage.getItem(response_cache_key)
  const matched_previous_response_keys =_.remove(_.map(questionData.answers, (answer, key) => _.includes(previous_survey_result_answers, answer.value) ? key : null), null)
  console.log(`matched_previous_response_keys ~~~ ${matched_previous_response_keys}`)
  let validDigits = Object.keys(questionData.answers)
  _.remove(validDigits, (digit) => _.includes(matched_previous_response_keys, digit))
  validDigits.push('*')
  console.log(validDigits)
  const surveyResponse = r.addGetDigits({
    action: res.locals.appUrl(`survey_result_assessment?q=${question}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&multiple=1`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: validDigits,
  })
  surveyResponse.addSpeakI18n('survey_multiple_others')
  res.send(r.toXML())
})

module.exports = app

