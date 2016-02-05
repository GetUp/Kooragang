exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('logs', (t) => {
      t.bigincrements('id').primary();
      t.timestamp('created_at').defaultTo(knex.fn.now());

      t.json('body');
    })
    .createTable('survey_results', (t) => {
      t.increments();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());

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
