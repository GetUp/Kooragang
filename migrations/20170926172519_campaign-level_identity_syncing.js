exports.up = knex => (
  knex.schema.table('campaigns', t => {
    t.boolean('sync_to_identity').defaultTo(true)
  })
)

exports.down = knex => (
  knex.schema.table('campaigns', t => {
    t.dropColumn('sync_to_identity')
  })
)
