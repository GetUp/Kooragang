exports.up = knex => knex.schema.table('campaigns', t => {
  t.boolean('user_set_number')
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('user_set_number')
})
