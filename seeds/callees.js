const seq = require('promise-sequential');
var questions_json = require('../questions.example.json');
exports.seed = function(knex, Promise) {
  return Promise.join(
      knex('calls').del(),
      knex('callees').del(),
      knex('campaigns').del()
    ).then(() => {
      return Promise.join(
        knex('campaigns').insert({id: 1, name: 'Power Dialler Test', phone_number: '61285994346', dialer: 'power', status: 'active', questions: questions_json}),
        knex('campaigns').insert({id: 2, name: 'Predictive Dialler Test', phone_number: '61285994346', dialer: 'ratio', status: 'active', ratio: 1, max_ratio: 1, questions: questions_json})
      );
    }).then(() => {
      return Promise.join(
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2}),
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2})
      );
    });
};
