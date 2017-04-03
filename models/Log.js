const { Model } = require('./Model');

module.exports = class Log extends Model {
  static get tableName() { return 'logs' }
}