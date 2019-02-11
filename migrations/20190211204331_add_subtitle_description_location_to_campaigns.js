exports.up = knex => knex.schema.table('campaigns', t => {
  t.text('subtitle')
  t.text('description')
  t.text('location')
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('subtitle')
  t.dropColumn('description')
  t.dropColumn('location')
})
