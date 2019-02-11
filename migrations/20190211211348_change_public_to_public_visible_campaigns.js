exports.up = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('public')
  t.boolean('public_visible').defaultTo(true)
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('public_visible')
  t.boolean('public').defaultTo(true)
})
