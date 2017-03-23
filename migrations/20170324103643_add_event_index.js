
exports.up = function(knex, Promise) {
  return knex.schema
    .table('events', table => table.index(['created_at', 'name']));
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('events', table => table.dropIndex(['created_at', 'name']));
};
