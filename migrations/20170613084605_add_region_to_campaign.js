
exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.string('number_region')
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.string('number_region')
    });
};
