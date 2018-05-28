exports.up = knex => knex.schema.table('callers', t => t.boolean('test').defaultTo(false))

exports.down = knex => knex.schema.table('callers', t => t.dropColumn('test'))