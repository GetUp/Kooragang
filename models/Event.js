const { Model } = require('./Model');

module.exports = class Event extends Model {
  static get tableName() { return 'events' }
}