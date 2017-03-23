
exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.string('ratio_decrease_factor').notNull().defaultTo(2);
    });

};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('ratio_decrease_factor');
    });
};
