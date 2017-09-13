exports.up = function(knex) {
  return knex.schema
    .table('callers', table => {
      table.text('inbound_phone_number').notNull()
      table.boolean('inbound_sip').defaultTo(false)
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropColumn('inbound_phone_number')
      table.dropColumn('inbound_sip')
    })
};
