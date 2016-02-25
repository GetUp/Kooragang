exports.seed = function(knex, Promise) {
  return Promise.join(
    knex('callees').del(),

    knex('callees').insert({first_name: 'Robin', phone_number: '61459262556', location: 'Chermside'}),
    knex('callees').insert({first_name: 'Chris', phone_number: '61459263861', location: 'Manly West'})
  );
};
