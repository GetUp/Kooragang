exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('callers', (t) => {
      t.increments();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('external_id');
      t.string('first_name');
      t.string('phone_number');
      t.string('location');
      t.timestamp('last_phoned_at');
    })
    .createTable('callees', (t) => {
      t.increments();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('external_id');
      t.string('first_name');
      t.string('phone_number');
      t.string('location');
      t.string('caller');
      t.timestamp('last_called_at');
    })
    .createTable('calls', (t) => {
      t.increments();
      t.bigInteger('log_id').references('id').inTable('logs');
      t.integer('caller_id').references('id').inTable('callees');
      t.integer('callee_id').references('id').inTable('callees');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('status');
      t.string('caller_uuid');
      t.string('caller_number');
      t.string('callee_uuid');
      t.string('callee_number');
      t.integer('duration');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('calls')
    .dropTableIfExists('callees')
    .dropTableIfExists('callers');
};
