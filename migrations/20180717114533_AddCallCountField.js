exports.up = knex => knex.schema.table('callees', t => {
  t.boolean('callable').defaultTo(true)
  t.integer('call_count').defaultTo(0)
  t.timestamp('callable_recalculated_at')
})

exports.down = knex => knex.schema.table('callees', t => {
  t.dropColumn('callable')
  t.dropColumn('call_count')
  t.dropColumn('callable_recalculated_at')
})
