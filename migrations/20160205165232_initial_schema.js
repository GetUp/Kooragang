exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('logs', (t) => {
      t.bigincrements('id').primary();
      t.timestamp('created_at').defaultTo(knex.fn.now());

      t.string('UUID');
      t.string('url');
      t.json('body');
      t.json('query');
      t.json('params');
      t.json('headers');
    })
    .createTable('survey_results', (t) => {
      t.increments();
      t.bigInteger('log_id').references('id').inTable('logs');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.string('caller_uuid');
      t.string('callee_uuid');
      t.string('callee_number');
      t.string('question');
      t.string('answer');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('logs')
    .dropTableIfExists('survey_results');
};
