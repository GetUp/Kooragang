exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.string('passcode');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('passcode');
    });
};
