
exports.up = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.integer('seconds_waiting').notNull().defaultTo(0);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropColumn('seconds_waiting');
    });
};
