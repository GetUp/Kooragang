exports.up = knex => knex.schema.table('campaigns', t => t.dropColumn('target_number'))
exports.down = knex => knex.schema.table('campaigns', t => t.text('target_number'))
