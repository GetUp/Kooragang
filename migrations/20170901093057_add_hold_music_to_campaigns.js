exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.specificType('hold_music', 'text[]');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('hold_music')
    })
};
