const plivo = require('plivo');
const promisfy = require('es6-promisify');
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'});

const {
  Call,
  Callee,
  Caller,
  Log,
  SurveyResult,
  transaction
} = require('./models');

// last called_at
const call = async () => {
  const callee = await Callee.query().where({phone_number: '61468519266'}).first();
  console.error('calling: ', callee.phone_number)
  const params = {
    //'to': '61285994347',
    //'to': '61285994346', // hangup
    to: callee.phone_number,
    from : '1111111111',
    answer_url : `https://bridger.ngrok.io/answer?name=${callee.first_name}&callee_id=${callee.id}`,
    hangup_url : `https://bridger.ngrok.io/hangup?callee_id=${callee.id}`,
    fallback_url : `https://bridger.ngrok.io/log?callee_id=${callee.id}`,
    caller_name: 'kooragang',
    time_limit: 10 * 60,
    ring_timeout: 30
  }
  return promisfy(api.make_call, {multiArgs: true})(params);
}
