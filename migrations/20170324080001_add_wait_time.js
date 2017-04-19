exports.up = knex =>
  knex.schema
    .table('callers', table => {
      table.integer('seconds_waiting').notNull().defaultTo(0)
    })

exports.down = knex =>
  knex.schema
    .table('callers', table => {
      table.dropColumn('seconds_waiting')
    })
