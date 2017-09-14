exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.boolean('revert_to_redundancy').defaultTo(false)
      table.dropColumn('revert_to_redundancy')
    })
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('revert_to_redundancy')
      table.boolean('revert_to_redundancy').defaultTo(false)
    })
};
