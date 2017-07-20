exports.up = function(knex) {
  return knex.schema
    .table('callees', t => {
      t.dropIndex(['call_attempts', 'id'])
      t.dropColumn('call_attempts')
      t.dropColumn('last_recycled_at')
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('callees', t => {
      t.integer('call_attempts').default(0)
      t.timestamp('last_recycled_at')
      t.index(['call_attempts', 'id'])
    });
};
