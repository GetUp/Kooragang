const { Model } = require('./Model');

module.exports = class Campaign extends Model {
  static get tableName() { return 'campaigns' }
  static get relationMappings() {
    return {
      callees: {
        relation: Model.OneToManyRelation,
        modelClass: __dirname + '/Callee',
        join: {
          from: 'campaigns.id',
          to: 'callees.campaign_id'
        }
      }
    }
  }
}