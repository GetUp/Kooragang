exports.up = knex => knex.schema.table('campaigns', t => {
  t.string('outgoing_number_region')
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('outgoing_number_region')
})
