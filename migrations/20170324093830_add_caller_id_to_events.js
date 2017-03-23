exports.up = function(knex, Promise) {
  return knex.schema
    .table('events', table => {
      table.integer('caller_id');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('events', table => {
      table.dropColumn('caller_id');
    });
};
