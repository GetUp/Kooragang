exports.up = knex => knex.schema.table('campaigns', t => t.specificType('languages', 'text[]').default("{en}").notNull())

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('languages'))