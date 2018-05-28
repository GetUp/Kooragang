exports.up = knex => knex.schema.table('callees', t => t.boolean('quarantined').default(false).notNull())

exports.down = knex => knex.schema.table('callees', t => t.dropColumn('quarantined'))