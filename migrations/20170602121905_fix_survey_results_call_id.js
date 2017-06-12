exports.up = function(knex, Promise) {
  return knex.schema
    .alterTable('survey_results', table => {
      table.bigInteger('call_id').alter();
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .alterTable('survey_results', table => {
      table.string('call_id').alter();
    });
};
