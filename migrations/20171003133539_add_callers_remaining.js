exports.up = knex => knex.schema.table('campaigns', t => t.integer('callers_remaining').defaultTo(0))

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('callers_remaining'))
