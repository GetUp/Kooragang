exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.json('questions').notNull().defaultTo('{}');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => table.dropColumn('questions'));
};
