exports.up = knex => knex.schema.raw("alter table only campaigns alter column lock_interactions set default false")

exports.down = knex => knex.schema.raw("alter table only campaigns alter column lock_interactions set default true")