exports.up = knex => knex.schema.table('campaigns', t => t.boolean('callback_answering_machines').defaultTo(false))

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('callback_answering_machines'))
