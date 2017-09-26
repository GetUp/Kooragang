exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.json('hours_of_operation').defaultTo('{"monday":{"start":"09:00:00","stop":"20:20:00"},"tuesday":{"start":"09:00:00","stop":"20:20:00"},"wednesday":{"start":"09:00:00","stop":"20:20:00"},"thursday":{"start":"09:00:00","stop":"20:20:00"},"friday":{"start":"09:00:00","stop":"20:20:00"},"saturday":{"start":"09:00:00","stop":"17:00:00"},"sunday":{"start":"09:00:00","stop":"17:00:00"}}')
      table.text('hours_of_operation_timezone')
      table.dropColumn('daily_start_operation')
      table.dropColumn('daily_stop_operation')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.time('daily_start_operation').defaultTo('00:00:00')
      table.time('daily_stop_operation').defaultTo('24:00:00')
      table.dropColumn('hours_of_operation')
      table.dropColumn('hours_of_operation_timezone')
    });
};
