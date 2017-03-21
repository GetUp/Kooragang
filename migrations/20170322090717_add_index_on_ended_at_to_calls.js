exports.up = function(knex, Promise) {
  return knex.schema
    .table('calls', table => table.index(['ended_at']));
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('calls', table => table.dropIndex(['ended_at']));
};
