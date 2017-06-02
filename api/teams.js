const app = require('express')()
const { Team } = require('../models')

//index
app.get('/api/teams', async (req, res) => {
  try {
    const team = await Team.query()
  	if (!team) throw 'No Team Created'
    return res.json({data: team})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//show
app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.query().where({id: req.params.id}).first()
  	if (!team) throw 'No Team Exists With ID: ${req.params.id}'
    return res.json({data: team})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//create
app.post('/api/teams', async (req, res) => {
  try {
    const team = await Team.query().insert(req.body.data)
  	if (!team) throw 'No Team Created'
    return res.json({data: team})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//update
app.put('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.query().where({id: req.params.id}).first()
    if (!team) throw 'No Team Exists With ID: ${req.params.id}'
   	team.$query().patch(req.body.data)
    return res.json({data: team})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

//delete
app.delete('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.query().where({id: req.params.id}).first()
    if (!team) throw 'No Team Exists With ID: ${req.params.id}'
    team.$query().delete()
    if (team) throw 'Team Was Not Deleted'
    return res.json({data: team})
  } catch (e) {
    console.log(e)
    return res.json({errors: e})
  }
})

module.exports = app;
