exports.up = knex =>
  knex.schema
    .createTable('logs', t => {
      t.bigincrements('id').primary()
      t.timestamp('created_at').defaultTo(knex.fn.now())
      t.string('UUID')
      t.string('url')
      t.json('body')
      t.json('query')
      t.json('params')
      t.json('headers')
    })
    .createTable('survey_results', t => {
      t.increments()
      t.bigInteger('log_id').references('id').inTable('logs')
      t.timestamp('created_at').defaultTo(knex.fn.now())
      t.timestamp('updated_at').defaultTo(knex.fn.now())
      t.string('call_id')
      t.string('question')
      t.string('answer')
    })

exports.down = knex =>
  knex.schema
    .dropTableIfExists('survey_results')
    .dropTableIfExists('logs')
