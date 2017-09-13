exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.specificType('redundancy_numbers', 'text[]');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('redundancy_numbers')
    })
};
