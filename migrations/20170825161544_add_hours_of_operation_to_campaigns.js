exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.json('hours_of_operation').defaultTo('{"sunday":{"start":"0900","stop":"1700"},"monday":{"start":"0900","stop":"2020"},"tuesday":{"start":"0900","stop":"2020"},"wednesday":{"start":"0900","stop":"2020"},"thursday":{"start":"0900","stop":"2020"},"friday":{"start":"0900","stop":"2020"},"saturday":{"start":"0900","stop":"1700"}}')
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
    });
};
