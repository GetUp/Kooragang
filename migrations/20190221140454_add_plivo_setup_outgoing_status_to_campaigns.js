exports.up = knex => knex.schema.table('campaigns', t => {
  t.string('plivo_setup_outgoing_status')
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('plivo_setup_outgoing_status')
})
