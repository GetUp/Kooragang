exports.up = function(knex) {
  return knex.schema
    .createTable('queued_calls', (t) => {
      t.bigincrements('id').primary();
      t.bigInteger('campaign_id');
      t.bigInteger('callee_id');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.string('status');
      t.json('response');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('queued_calls')
};
