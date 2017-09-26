exports.up = function(knex, Promise) {
  return knex.schema
    .table('callees', table => {
      table.index(['last_called_at', 'campaign_id']);
      table.index(['call_attempts', 'id']);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callees', table => {
      table.dropIndex(['last_called_at', 'campaign_id']);
      table.dropIndex(['call_attempts', 'id']);
    });
};
