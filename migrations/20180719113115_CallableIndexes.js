
exports.up = knex =>
  knex.schema.table('callees', table => {
    table.index(['callable'])
    table.index(['call_count'])
  })

exports.down = knex =>
  knex.schema.table('callees', table => {
    table.dropIndex(['callable'])
    table.dropIndex(['call_count'])
  })
