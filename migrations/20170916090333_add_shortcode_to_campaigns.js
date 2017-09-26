exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.text('shortcode')
    })
    .table('campaigns', table => table.index(['shortcode']))
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('shortcode')
    })
    .table('campaigns', table => table.dropIndex(['shortcode']));
};
