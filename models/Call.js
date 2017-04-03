const { Model } = require('./Model');

module.exports = class Call extends Model {
  static get tableName() { return 'calls' }
}