exports.seed = function(knex, Promise) {
  return Promise.join(
    knex('calls').del(),
    knex('callers').del(),

    knex('callers').insert({first_name: 'Tim', phone_number: '61413877188', location: 'Omnipresent'}),
    knex('callers').insert({first_name: 'Skype', phone_number: 'anonymous', location: 'the Information Super Highway'})
  );
};
