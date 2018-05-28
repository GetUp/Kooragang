exports.up = knex => knex.schema.table('campaigns', t => t.json('diagram'))

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('diagram'))