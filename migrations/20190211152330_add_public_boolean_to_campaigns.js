exports.up = knex => knex.schema.table('campaigns', t => {
  t.boolean('public').defaultTo(true)
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('public')
})
