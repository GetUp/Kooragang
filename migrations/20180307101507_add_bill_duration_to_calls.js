exports.up = function(knex) {
  return knex.schema
    .table('calls', t => {
      t.integer('bill_duration').defaultTo(0)
      t.float('total_cost').defaultTo(0)
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('calls', t => {
      t.dropColumn('bill_duration')
      t.dropColumn('total_cost')
    })
};
