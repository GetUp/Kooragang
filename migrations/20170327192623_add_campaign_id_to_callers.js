exports.up = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.integer('campaign_id').references('id').inTable('campaigns');
      table.index(['status', 'campaign_id']);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callers', table => {
      table.dropIndex(['status', 'campaign_id']);
      table.dropColumn('campaign_id');
    });

};
