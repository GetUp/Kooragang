exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.string('redirect_number')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('redirect_number')
    });
};
