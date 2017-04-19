exports.up = knex =>
  knex.schema
    .table('campaigns', table => {
      table.string('sms_number')
    })

exports.down = knex =>
  knex.schema
    .table('campaigns', table => {
      table.dropColumn('sms_number')
    })
