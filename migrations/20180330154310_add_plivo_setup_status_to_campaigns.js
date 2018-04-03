exports.up = knex => knex.schema.table('campaigns', t => t.specificType('plivo_setup_status', 'text'))

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('plivo_setup_status'))