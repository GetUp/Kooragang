const app = require('express')()
const { SurveyResult } = require('../models')

//index
app.get('/api/survey-results', async (req, res) => {
  try {
    const survey_result = await SurveyResult.query()
  	if (!survey_result) throw 'No SurveyResult Created'
    return res.json({data: survey_result})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//show
app.get('/api/survey-results/:id', async (req, res) => {
  try {
    const survey_result = await SurveyResult.query().where({id: req.params.id}).first()
  	if (!survey_result) throw 'No SurveyResult Exists With ID: ${req.params.id}'
    return res.json({data: survey_result})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//create
app.post('/api/survey-results', async (req, res) => {
  try {
    const survey_result = await SurveyResult.query().insert(req.body.data)
  	if (!survey_result) throw 'No SurveyResult Created'
    return res.json({data: survey_result})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//update
app.put('/api/survey-results/:id', async (req, res) => {
  try {
    const survey_result = await SurveyResult.query().where({id: req.params.id}).first()
    if (!survey_result) throw 'No SurveyResult Exists With ID: ${req.params.id}'
   	survey_result.$query().patch(req.body.data)
    return res.json({data: survey_result})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//delete
app.delete('/api/survey-results/:id', async (req, res) => {
  try {
    const survey_result = await SurveyResult.query().where({id: req.params.id}).first()
    if (!survey_result) throw 'No SurveyResult Exists With ID: ${req.params.id}'
    survey_result.$query().delete()
    if (survey_result) throw 'SurveyResult Was Not Deleted'
    return res.json({data: survey_result})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

module.exports = app;
