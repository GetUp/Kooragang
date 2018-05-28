exports.up = function(knex) {
  return knex.schema
    .table('campaigns', t => {
      t.boolean('calling_weekends').default(false)
      t.timestamp('calling_schedule_start')
      t.timestamp('calling_schedule_end')
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('campaigns', t => {
      t.dropColumn('calling_weekends')
      t.dropColumn('calling_schedule_start')
      t.dropColumn('calling_schedule_end')
    })
};