exports.up = function(knex) {
  return knex.schema.table('campaigns', table => table.string('outgoing_number'))
};

exports.down = function(knex) {
  return knex.schema.table('campaigns', table => table.dropColumn('outgoing_number'))
};
