
exports.up = function(knex, Promise) {
  return knex.schema
    .table('callees', t => {
      t.string('shortCode');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callees', t => t.dropColumn('shortCode'));
};
