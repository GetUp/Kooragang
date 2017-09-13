exports.up = function(knex) {
  return knex.schema
    .table('callers', table => {
      table.text('inbound_phone_number').notNull()
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropColumn('inbound_phone_number')
    })
};
