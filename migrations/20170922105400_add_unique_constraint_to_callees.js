exports.up = function(knex) {
  return knex.schema
    .table('callees', table => {
      table.unique(['campaign_id', 'phone_number'])
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('callees', table => {
      table.dropUnique(['campaign_id', 'phone_number'])
    })
};