exports.up = knex =>
  knex.schema
    .table('calls', table => table.index(['ended_at']))

exports.down = knex =>
  knex.schema
    .table('calls', table => table.dropIndex(['ended_at']))
