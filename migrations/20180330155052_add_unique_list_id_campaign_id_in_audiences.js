exports.up = knex => knex.schema.table('audiences', t => t.unique(['list_id', 'campaign_id']))

exports.down = knex => knex.schema.table('audiences', t => t.dropUnique(['list_id', 'campaign_id']))