exports.up = knex =>
  knex.schema
    .table('events', table => {
      table.index(['created_at', 'name'])
    })

exports.down = knex =>
  knex.schema
    .table('events', table => {
      table.dropIndex(['created_at', 'name'])
    })
