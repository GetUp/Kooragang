const env = process.env.NODE_ENV || 'development';
const app = require('express')();
const _ = require('lodash');
const moment = require('moment');
const config = require('../knexfile');
const knex = require('knex')(config[env]);
const { Callee, Team } = require('../models');
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.all('/team', async (req, res) => {
  res.set('Content-Type', 'text/html')
  let team
  let data
  if (req.query.passcode) {
	  team = await Team.query().where({passcode: req.query.passcode}).first()
    data = await knex.raw(
      `select c.created_at::date as date, cp.name, count(distinct ca.phone_number) as callers, count(c.id) as calls,
      sum(case when disposition !~* '(no answer|machine|meaningful)' then 1 else 0 end) as non_meaningful_conversations,
      sum(case when disposition ~* 'meaningful' then 1 else 0 end) as meaningful_conversations,
      sum(case when action !~* 'not' then 1 else 0 end) as actions,
      sum(case when loan_support ~* 'supports' then 1 else 0 end) as supports_loan,
      sum(case when loan_support ~* 'unsure' then 1 else 0 end) as unsure_of_support,
      sum(case when loan_support ~* 'does not support' then 1 else 0 end) as does_not_support
      from callees ce
      inner join calls c on c.callee_id = ce.id
      inner join campaigns cp on cp.id = ce.campaign_id
      left outer join callers ca on (c.caller_id = ca.id)
      left outer join (
      select * from crosstab(
      'select call_id::integer, question, answer from survey_results sr
      inner join calls c on c.id = sr.call_id::integer
      inner join callees ce on ce.id = c.callee_id
      inner join campaigns cp on cp.id = ce.campaign_id
      where  cp.name !~* ''test''',
      'select distinct question from survey_results sr
      inner join calls c on c.id = sr.call_id::integer
      inner join callees ce on ce.id = c.callee_id
      inner join campaigns cp on cp.id = ce.campaign_id
      where  cp.name !~* ''test'' order by question'
      ) as (call_id integer, action text, coalition_support text, disposition text, loan_support text, preferred_spending text, voter_id text)
      ) answers on answers.call_id = c.id
      where cp.name !~* 'test'
      and ca.team_id = ${team.id}
      group by 1,2
      order by date desc;`
    );
  }
  return res.render('team.ejs', {team, data, moment: moment})
});

module.exports = app
