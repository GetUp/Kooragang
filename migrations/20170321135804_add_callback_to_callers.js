exports.up = function(knex, Promise) {
  return knex.schema
    .table('callers', t => {
      t.boolean('callback').defaultTo(false);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => table.dropColumn('callback'));
};
