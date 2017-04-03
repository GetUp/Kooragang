
exports.up = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.string('sms_number')
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('campaigns', table => {
      table.dropColumn('sms_number')
    });
};
