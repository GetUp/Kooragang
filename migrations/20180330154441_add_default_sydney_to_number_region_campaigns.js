exports.up = knex => knex.schema.raw("alter table only campaigns alter column number_region set default 'Sydney'")

exports.down = knex => knex.schema.raw("alter table only campaigns alter column number_region set default null")