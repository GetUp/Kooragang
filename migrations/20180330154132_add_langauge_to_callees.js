exports.up = knex => knex.schema.table('callees', t => t.specificType('language', 'text').default('en').notNull())

exports.down = knex => knex.schema.table('callees', t => t.dropColumn('language'))