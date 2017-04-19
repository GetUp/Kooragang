exports.up = knex =>
  knex.schema
    .table('campaigns', table => {
      table.string('passcode')
    })

exports.down = knex =>
  knex.schema
    .table('campaigns', table => {
      table.dropColumn('passcode')
    })
