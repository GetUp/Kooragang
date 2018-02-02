exports.up = knex => knex.schema.table('campaigns', t => t.boolean('use_reference_codes').defaultTo(false))

exports.down = knex => knex.schema.table('campaigns', t => t.boolean('use_reference_codes'))
