exports.up = function(knex, Promise) {
  return Promise.join(
    knex.raw(`DROP ROLE IF EXISTS readonly;`)
  ).then(() => {
    return Promise.join(
      knex.raw(`CREATE ROLE readonly WITH LOGIN;`)
    )
  })
  .then(() => {
    return Promise.join(
      knex.raw(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;`)
    )
  });
};

exports.down = function(knex, Promise) {
  return Promise.join(
    knex.raw(`DROP ROLE IF EXISTS readonly;`)
  )
};