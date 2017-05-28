exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.json('custom_dialogue').notNull().defaultTo('{}');
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('custom_dialogue');
    });
};
