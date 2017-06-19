const env = process.env.NODE_ENV || 'development'
const config = require('../knexfile')   
const knex = require('knex')(config[env])
const read_only_config = require('../knexfile_read_only')   
const read_only_knex = require('knex')(read_only_config[env])
const objection = require('objection')
const Model = objection.Model
Model.knex(knex)

module.exports = class Base extends Model {
  $queryReadOnly() {
    return this.$query(read_only_knex)
  }
  static queryReadOnly() {
    return this.query(read_only_knex)
  }
  static bindReadOnly() {
    return this.bindKnex(read_only_knex)
  }
}
