const { Model } = require('./Model');

module.exports = class Caller extends Model {
  static get tableName() { return 'callers' }
  static get relationMappings() {
    return {
      calls: {
        relation: Model.OneToManyRelation,
        modelClass: __dirname + '/Call',
        join: {
          from: 'callers.id',
          to: 'calls.caller_id'
        }
      }
    }
  }
}