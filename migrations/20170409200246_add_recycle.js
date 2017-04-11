exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.integer('max_call_attempts').notNull().default(1);
    })
    .table('callees', t => {
      t.timestamp('last_recycled_at');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.dropColumn('max_call_attempts')
    })
    .table('callees', t => {
      t.dropColumn('last_recycled_at')
    });
};
