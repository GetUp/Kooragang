const { Model } = require('./Model');

module.exports = class Callee extends Model {
  static get tableName() { return 'callees' }
  static get relationMappings() {
    return {
      calls: {
        relation: Model.OneToManyRelation,
        modelClass: __dirname + '/Call',
        join: {
          from: 'callees.id',
          to: 'calls.callee_id'
        }
      },
      campaign: {
        relation: Model.OneToOneRelation,
        modelClass: __dirname + '/Campaign',
        join: {
          from: 'callees.campaign_id',
          to: 'campaigns.id'
        }
      }
    }
  }
}