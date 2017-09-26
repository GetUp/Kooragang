exports.up = function(knex) {
  return knex.schema
    .table('campaigns', table => {
      table.boolean('hud').notNull().defaultTo(false)
    })
    .table('callees', table => {
      table.json('data')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('hud')
    })
    .table('callees', table => {
      table.dropColumn('data')
    });
};
