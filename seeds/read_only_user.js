exports.seed = function(knex, Promise) {
  return Promise.join(
    knex.raw(`DROP ROLE IF EXISTS readonly;`),
    knex.raw(`CREATE ROLE readonly WITH LOGIN;`),
    knex.raw(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;`)
  )
}