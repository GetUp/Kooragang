exports.up = knex =>
  knex.schema
    .table('campaigns', table => {
      table.string('ratio_decrease_factor').notNull().defaultTo(2)
    })

exports.down = knex =>
  knex.schema
    .table('campaigns', table => {
      table.dropColumn('ratio_decrease_factor')
    })
