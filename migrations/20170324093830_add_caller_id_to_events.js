exports.up = knex =>
  knex.schema
    .table('events', table => {
      table.integer('caller_id')
    })

exports.down = knex =>
  knex.schema
    .table('events', table => {
      table.dropColumn('caller_id')
    })
