exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.integer('calls_in_progress').notNull().defaultTo(0);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => table.dropColumn('calls_in_progress'));
};
