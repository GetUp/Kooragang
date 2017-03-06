
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('campaigns', (t) => {
      t.increments();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('name').notNull();
      t.string('status');
      t.string('dialer');
      t.integer('max_ratio').defaultTo(1);
      t.integer('ratio').defaultTo(0);
      t.timestamp('last_checked_ratio_at');
      t.string('ended_at');
      t.index(['name']);
      t.index(['status']);
    }).table('callees', t => {
      t.bigInteger('campaign_id').references('id').inTable('campaigns').notNull();
    }).createTable('events', (t) => {
      t.increments();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('name').notNull();
      t.integer('value');
      t.bigInteger('campaign_id').references('id').inTable('campaigns');
      t.bigInteger('call_id').references('id').inTable('calls');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('campaigns')
    .table('callees', table => table.dropColumn('campaign_id'));
};
