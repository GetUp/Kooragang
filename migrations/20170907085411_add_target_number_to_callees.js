exports.up = function(knex) {
  return knex.schema
    .table('callees', table => {
      table.specificType('target_number', 'text');
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callees', table => {
      table.dropColumn('target_number')
    })
};
