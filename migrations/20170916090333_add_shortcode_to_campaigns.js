exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.text('shortcode')
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('shortcode')
    })
};