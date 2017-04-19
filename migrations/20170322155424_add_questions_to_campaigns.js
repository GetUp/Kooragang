exports.up = knex =>
  knex.schema
    .table('campaigns', t => {
      t.json('questions').notNull().defaultTo('{}')
      t.json('more_info').notNull().defaultTo('{}')
    })

exports.down = knex =>
  knex.schema
    .table('campaigns', t => {
      t.dropColumn('questions')
      t.dropColumn('more_info')
    })
