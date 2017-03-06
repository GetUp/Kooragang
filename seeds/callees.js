const seq = require('promise-sequential');
exports.seed = function(knex, Promise) {
  return Promise.join(
      knex('calls').del(),
      knex('callees').del(),
      knex('campaigns').del()
    ).then(() => {
      return Promise.join(
        knex('campaigns').insert({id: 1, name: 'Power Dialer Test', dialer: 'power'}),
        knex('campaigns').insert({id: 2, name: 'Predictive Dailer Test', dialer: 'predictive'})
      );
    }).then(() => {
      return Promise.join(
        knex('callees').insert({first_name: 'Robin', phone_number: '61285994347', location: 'Chermside', campaign_id: 1}),
        knex('callees').insert({first_name: 'Chris', phone_number: '61285994347', location: 'Manly West', campaign_id: 2})
      );
    });
};
