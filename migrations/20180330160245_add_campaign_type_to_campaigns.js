exports.up = knex => knex.schema.table('campaigns', t => t.string('campaign_type'))

exports.down = knex => knex.schema.table('campaigns', t => t.dropColumn('campaign_type'))