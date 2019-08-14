exports.up = knex => knex.schema.table('campaigns', t => t.dropColumn('calls_in_progress') )

exports.down = knex => knex.schema.table('campaigns', t => t.text('calls_in_progress'))
