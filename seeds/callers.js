exports.seed = function(knex, Promise) {
  return Promise.join(
    knex('calls').del(),
    knex('callers').del(),

    knex('callers').insert({first_name: 'Tim', phone_number: '61413877188', location: 'Omnipresent', campaign_id: 1}),
    knex('callers').insert({first_name: 'Skype', phone_number: 'anonymous', location: 'the Information Super Highway', campaign_id: 2}),
    knex('callers').insert({first_name: 'Bridger', phone_number: 'bridger170216043416', location: 'Newcastle', campaign_id: 1})
  );
};
