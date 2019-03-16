exports.up = knex => knex.schema.table('campaigns', t => t.integer('ring_timeout') )

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('ring_timeout') )
