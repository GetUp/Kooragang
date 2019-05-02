
exports.up = knex =>
  knex.schema.table('callees', table => {
    table.dropIndex(['call_count', 'last_called_at', 'id'])
    table.index(['callable', 'campaign_id', 'call_count', 'last_called_at', 'id'])
  })

exports.down = knex =>
  knex.schema.table('callees', table => {
    table.dropIndex(['callable', 'campaign_id', 'call_count', 'last_called_at', 'id'])
    table.index(['call_count', 'last_called_at', 'id'])
  })
