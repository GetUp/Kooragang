const { Model } = require('./Model');

module.exports = class SurveyResult extends Model {
  static get tableName() { return 'survey_results' }
}