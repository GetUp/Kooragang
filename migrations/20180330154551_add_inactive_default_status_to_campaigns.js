exports.up = knex => knex.schema.raw("alter table only campaigns alter column status set default 'inactive'")

exports.down = knex => knex.schema.raw("alter table only campaigns alter column status set default null")