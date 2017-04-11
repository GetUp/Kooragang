
exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.time('daily_start_operation').defaultTo('00:00:00')
      table.time('daily_stop_operation').defaultTo('24:00:00')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('daily_start_operation')
      table.dropColumn('daily_stop_operation')
    });
};
