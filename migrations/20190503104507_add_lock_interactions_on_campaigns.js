exports.up = knex => knex.schema.table('campaigns', t => t.boolean('lock_interactions').default(true).notNull())

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('lock_interactions'))