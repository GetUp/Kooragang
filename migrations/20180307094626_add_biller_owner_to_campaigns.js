
exports.up = function(knex) {
  return knex.schema
    .table('campaigns', t => {
      t.string('owner')
      t.string('biller')
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('campaigns', t => {
      t.dropColumn('owner')
      t.dropColumn('biller')
    })
};
