exports.up = knex =>
  knex.schema
    .table('callers', table => {
      table.string('call_uuid')
      table.index(['call_uuid'])
    })

exports.down = knex =>
  knex.schema
    .table('callers', table => {
      table.dropColumn('call_uuid')
      table.dropIndex(['call_uuid'])
    })
