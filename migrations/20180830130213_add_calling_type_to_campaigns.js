exports.up = knex => knex.schema.table('campaigns', t => {
  t.specificType('calling_type', 'text[]').defaultTo('{}')
  t.specificType('target_numbers', 'text[]').defaultTo('{}')
})

exports.down = knex => knex.schema.table('campaigns', t => {
  t.dropColumn('calling_type')
  t.dropColumn('target_numbers')
})