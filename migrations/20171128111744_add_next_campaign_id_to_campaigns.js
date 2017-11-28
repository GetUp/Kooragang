
exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.text('next_campaign_id')
    })
};

exports.down = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('next_campaign_id')
    })
};
