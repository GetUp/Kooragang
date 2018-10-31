exports.up = knex => knex.schema.table('audiences', t => {
  t.bigInteger('sync_id')
  t.integer('priority').defaultTo(1)
  t.timestamp('updated_at').defaultTo(knex.fn.now());
  t.dropColumn('list_id')
  t.dropColumn('list_name')
  t.dropColumn('list_member_count')
  t.dropColumn('imported_member_count')
})

exports.down = knex => knex.schema.table('audiences', t => {
  t.dropColumn('list_member_count')
  t.dropColumn('imported_member_count')
  t.dropColumn('updated_at')
  t.bigInteger('list_id').notNull();
  t.string('list_name').notNull();
  t.bigInteger('list_member_count').notNull();
  t.bigInteger('imported_member_count').notNull().default(0);
})
