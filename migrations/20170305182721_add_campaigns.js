exports.up = knex =>
  knex.schema
    .createTable('campaigns', t => {
      t.increments()
      t.timestamp('created_at').defaultTo(knex.fn.now())
      t.timestamp('updated_at').defaultTo(knex.fn.now())
      t.string('name').notNull()
      t.string('status')
      t.string('dialer')
      t.string('script_url')
      t.string('phone_number')
      t.decimal('max_ratio').defaultTo(1.0)
      t.decimal('ratio').defaultTo(1.0)
      t.timestamp('last_checked_ratio_at')
      t.string('ended_at')
      t.boolean('detect_answering_machine').defaultTo(false)
      t.decimal('acceptable_drop_rate').defaultTo(0)
      t.decimal('ratio_increment').defaultTo(0.2)
      t.integer('ratio_window').defaultTo(600)
      t.integer('recalculate_ratio_window').defaultTo(180)
      t.index(['name'])
      t.index(['status'])
    }).table('callees', t => {
      t.bigInteger('campaign_id').references('id').inTable('campaigns').notNull()
    }).createTable('events', t => {
      t.increments()
      t.timestamp('created_at').defaultTo(knex.fn.now())
      t.timestamp('updated_at').defaultTo(knex.fn.now())
      t.string('name').notNull()
      t.text('value')
      t.bigInteger('campaign_id').references('id').inTable('campaigns')
      t.bigInteger('call_id').references('id').inTable('calls')
    })

exports.down = knex =>
  knex.schema
    .dropTableIfExists('campaigns')
    .dropTableIfExists('events')
    .table('callees', table => table.dropColumn('campaign_id'))
