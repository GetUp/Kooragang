
exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.boolean('transfer_to_target').defaultTo(false)
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('transfer_to_target')
    });
};
