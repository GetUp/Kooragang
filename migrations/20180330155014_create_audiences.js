exports.up = function(knex) {
  return knex.schema
    .createTable('audiences', (t) => {
      t.increments();
      t.bigInteger('list_id').notNull();
      t.string('list_name').notNull();
      t.bigInteger('list_member_count').notNull();
      t.bigInteger('imported_member_count').notNull().default(0);
      t.bigInteger('campaign_id').references('id').inTable('campaigns');
      t.string('status').notNull().default('inactive');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audiences')
};