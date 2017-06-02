const app = require('express')()
const { Redirect } = require('../models')

//index
app.get('/api/redirects', async (req, res) => {
  try {
    const redirect = await Redirect.query()
  	if (!redirect) throw 'No Redirect Created'
    return res.json({data: redirect})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//show
app.get('/api/redirects/:id', async (req, res) => {
  try {
    const redirect = await Redirect.query().where({id: req.params.id}).first()
  	if (!redirect) throw 'No Redirect Exists With ID: ${req.params.id}'
    return res.json({data: redirect})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//create
app.post('/api/redirects', async (req, res) => {
  try {
    const redirect = await Redirect.query().insert(req.body.data)
  	if (!redirect) throw 'No Redirect Created'
    return res.json({data: redirect})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//update
app.put('/api/redirects/:id', async (req, res) => {
  try {
    const redirect = await Redirect.query().where({id: req.params.id}).first()
    if (!redirect) throw 'No Redirect Exists With ID: ${req.params.id}'
   	redirect.$query().patch(req.body.data)
    return res.json({data: redirect})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//delete
app.delete('/api/redirects/:id', async (req, res) => {
  try {
    const redirect = await Redirect.query().where({id: req.params.id}).first()
    if (!redirect) throw 'No Redirect Exists With ID: ${req.params.id}'
    redirect.$query().delete()
    if (redirect) throw 'Redirect Was Not Deleted'
    return res.json({data: redirect})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

module.exports = app;
