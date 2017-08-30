exports.up = function(knex) {
  return knex.schema.table('campaigns', table => table.boolean('log_no_calls').notNull().defaultTo(false))
};

exports.down = function(knex) {
  return knex.schema.table('campaigns', table => table.dropColumn('log_no_calls'))
};
