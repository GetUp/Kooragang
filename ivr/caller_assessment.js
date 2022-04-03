const app = require('express')()
const plivo = require('plivo')
const _ = require('lodash')
const {Caller, Campaign} = require('../models')

app.post('/survey_assessment', async ({query}, res) => {
  const r = plivo.Response()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const questions = campaign.questions
  const question = query.q
  const caller_id = query.caller_id
  const questionData = questions[question]
  const surveyResponse = r.addGetDigits({
    action: res.locals.plivoCallbackUrl(`survey_result_assessment?q=${question}&caller_id=${caller_id}&campaign_id=${query.campaign_id}&assessment=1`),
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
  const answers = question.answers
  const multiple = query.multiple === '1'

  if (multiple && (body.Digits  === '*' || query.digit  === '*')) {
    if (question.next) {
      r.addRedirect(res.locals.plivoCallbackUrl(`survey_assessment?q=${question.next}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&assessment=1`))
    } else {
      r.addSpeakI18n('end_assessment_survey')
      r.addRedirect(res.locals.plivoCallbackUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1&callback=0&authenticated=${query.authenticated ? '1' : '0'}&assessment=1`))
    }
    return res.send(r.toXML())
  }

  const disposition = question.answers[body.Digits || query.digit].value
  const next = question.answers[body.Digits || query.digit].next

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

  const previous_survey_results = query.assessment_responses
  let current_survey_results = previous_survey_results ? _.split(previous_survey_results, ',') : []
  current_survey_results.push(disposition)
  const current_survey_results_string = _.join(current_survey_results, ',')
  const all_possible_responses_entered = current_survey_results.length >= Object.keys(answers).length

  if (query.q != 'disposition' && question.multiple && !all_possible_responses_entered) {
    r.addRedirect(res.locals.plivoCallbackUrl(`survey_multiple_assessment?q=${query.q}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&assessment_responses=${current_survey_results_string}`))
    return res.send(r.toXML())
  } else if (query.q != 'disposition' && question.multiple && all_possible_responses_entered) {
    r.addSpeakI18n('survey_multiple_all_possible_entered', {question: question.name})
  }

  if (next) {
    r.addRedirect(res.locals.plivoCallbackUrl(`survey_assessment?q=${next}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&assessment=1`))
  } else {
    r.addSpeakI18n('end_assessment_survey')
    r.addRedirect(res.locals.plivoCallbackUrl(`briefing?campaign_id=${campaign.id}&caller_number=${caller.phone_number}&start=1&callback=0&authenticated=${query.authenticated ? '1' : '0'}&assessment=1`))
  }
  res.send(r.toXML())
})

app.post('/survey_multiple_assessment', async ({query}, res) => {
  const r = plivo.Response()
  const campaign = await Campaign.query().where({id: query.campaign_id}).first()
  const questions = campaign.questions
  const question = query.q
  const questionData = questions[question]
  const current_survey_results = _.split(query.assessment_responses, ',')
  const current_survey_results_string = _.join(current_survey_results, ',')
  const matched_previous_response_keys =_.remove(_.map(questionData.answers,
    (answer, key) => _.includes(current_survey_results, answer.value) ? key : null), null)
  let validDigits = Object.keys(questionData.answers)
  _.remove(validDigits, (digit) => _.includes(matched_previous_response_keys, digit))
  if (current_survey_results) { validDigits.push('*') }
  const surveyResponse = r.addGetDigits({
    action: res.locals.plivoCallbackUrl(`survey_result_assessment?q=${question}&caller_id=${query.caller_id}&campaign_id=${query.campaign_id}&multiple=1&assessment_responses=${current_survey_results_string}`),
    redirect: true,
    retries: 10,
    numDigits: 1,
    timeout: 10,
    validDigits: validDigits
  })
  surveyResponse.addSpeakI18n('survey_multiple_others')
  surveyResponse.addWait({length: 1})
  surveyResponse.addSpeakI18n('survey_multiple_others_next')
  res.send(r.toXML())
})

module.exports = app
