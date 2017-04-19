exports.up = knex =>
  knex.schema
    .table('callers', t => {
      t.boolean('callback').defaultTo(false)
    })

exports.down = knex =>
  knex.schema
    .table('callers', table => table.dropColumn('callback'))
