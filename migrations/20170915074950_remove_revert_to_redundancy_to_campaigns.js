exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('revert_to_redundancy')
    })
};

exports.down = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.boolean('revert_to_redundancy').defaultTo(false)
    })
};
