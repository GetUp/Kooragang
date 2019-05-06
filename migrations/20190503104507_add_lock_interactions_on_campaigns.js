exports.up = knex => knex.schema.table('campaigns', t => t.boolean('lock_interactions').default(false).notNull())

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('lock_interactions'))