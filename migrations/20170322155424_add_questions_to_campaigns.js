exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.string('script_url').notNull().defaultTo('')
      t.json('questions').notNull().defaultTo('{}')
      t.json('more_info').notNull().defaultTo('{}')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', t => {
      t.dropColumn('questions')
      t.dropColumn('script_url')
      t.dropColumn('more_info')
    });
};
