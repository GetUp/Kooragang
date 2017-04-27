exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.integer('max_call_attempts').notNull().default(1);
      t.integer('no_call_window').notNull().default(4*60);
      t.boolean('exhaust_callees_before_recycling').notNull().default(true);
    })
    .table('callees', t => {
      t.timestamp('last_recycled_at');
      t.integer('call_attempts').default(0);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.dropColumn('max_call_attempts')
      t.dropColumn('no_call_window')
      t.dropColumn('exhaust_callees_before_recycling')
    })
    .table('callees', t => {
      t.dropColumn('last_recycled_at')
      t.dropColumn('call_attempts')
    });
};
