exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.integer('min_callers_for_ratio').notNull().defaultTo(5)
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('min_callers_for_ratio')
    })
};
