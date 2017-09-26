exports.up = function(knex) {
  return knex.schema
    .table('callers', table => {
      table.text('inbound_phone_number')
      table.boolean('created_from_incoming').defaultTo(true)
      table.boolean('inbound_sip').defaultTo(false)
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropColumn('inbound_phone_number')
      table.dropColumn('created_from_incoming')
      table.dropColumn('inbound_sip')
    })
};
