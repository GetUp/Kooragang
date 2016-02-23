exports.seed = function(knex, Promise) {
  const callees = knex('callees');
  return Promise.join(
    callees.del(),

    callees.insert({first_name: 'Robin', phone_number: '+61 459 262 556', location: 'Chermside'}),
    callees.insert({first_name: 'Chris', phone_number: '+61 459 263 861', location: 'Manly West'})
  );
};
