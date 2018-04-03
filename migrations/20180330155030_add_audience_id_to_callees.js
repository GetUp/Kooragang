exports.up = knex => knex.schema.table('callees', t => t.bigInteger('audience_id').references('id').inTable('audiences'))

exports.down = knex => knex.schema.table('callees', t => t.dropColumn('audience_id'))