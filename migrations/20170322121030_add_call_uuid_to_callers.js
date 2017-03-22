exports.up = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.string('call_uuid')
      table.index(['call_uuid'])
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropColumn('call_uuid')
      table.dropIndex(['call_uuid'])
    });
};
