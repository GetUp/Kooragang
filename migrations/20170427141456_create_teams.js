
exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('teams', (t) => {
      t.increments();
      t.string('name').unique();
      t.string('passcode').unique();
      t.timestamp('last_user_joined_at');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('users', (t) => {
      t.increments();
      t.string('phone_number').unique();
      t.integer('team_id').references('id').inTable('teams');
      t.timestamp('last_joined_at');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .table('callers', table => {
      table.integer('team_id').references('id').inTable('teams');
      table.index(['team_id'])
    })
    .table('campaigns', table => {
      table.boolean('teams').defaultTo(false);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('teams')
    .dropTableIfExists('users')
    .table('callers', table => {
      table.dropIndex(['team_id']);
      table.dropColumn('team_id');
    })
    .table('campaigns', table => {
      table.dropColumn('teams');
    });
};
