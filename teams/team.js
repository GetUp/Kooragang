const app = require('express')();
const _ = require('lodash');
const { User, Team } = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.all('/vollie', async (req, res) => {
  res.set('Content-Type', 'text/html');
  let user
  let team
  if (req.query.phone_number) {
	  user = await User.query().where({phone_number: req.query.phone_number}).first();
	  if (user && user.team_id) { team = await Team.query().where({id: user.team_id}).first() }
  }
  return res.render('vollie.ejs', {user, team})
});

app.all('/team', async (req, res) => {
  res.set('Content-Type', 'text/html');
  let team
  let users
  if (req.query.passcode) {
	  team = await Team.query().where({passcode: req.query.passcode}).first()
	  users = await team.users
  }
  return res.render('team.ejs', {team, users})
});

module.exports = app
