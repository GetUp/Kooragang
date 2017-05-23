exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('redirects', (t) => {
      t.bigincrements('id').primary();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.string('call_uuid');
      t.bigInteger('campaign_id').references('id').inTable('campaigns').notNull();
      t.bigInteger('callee_id').references('id').inTable('callees');
      t.string('phone_number');
      t.string('redirect_number');
      t.string('target_number');
      t.index('campaign_id');
    })
    .table('campaigns', table => {
      table.string('target_number')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('redirects')
    .table('campaigns', table => {
      table.dropColumn('target_number')
    });
};
