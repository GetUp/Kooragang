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

module.exports.dial = async appUrl => {
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const calleeTransaction = await transaction.start(Callee.knex());
  const callee = await Callee.bindTransaction(calleeTransaction).query()
    .whereRaw(`length(${cleanedNumber}) = 11`)
    .whereNull('last_called_at')
    .orderBy('id')
    .first();
  if (!callee) {
    // update campaign
    if (process.env.NODE_ENV === 'development') console.error('NO MORE NUMBERS')
    return await calleeTransaction.commit();
  }else{
    await Callee.bindTransaction(calleeTransaction).query()
      .patchAndFetchById(callee.id, {last_called_at: new Date})
    await calleeTransaction.commit();
    const params = {
      to: callee.phone_number,
      from : '1111111111',
      answer_url : `${appUrl}/answer?name=${callee.first_name}&callee_id=${callee.id}`,
      hangup_url : `${appUrl}/hangup?callee_id=${callee.id}`,
      fallback_url : `${appUrl}/log?callee_id=${callee.id}`,
      time_limit: 10 * 60,
      ring_timeout: 30
    };
    if (process.env.NODE_ENV === 'development') console.error('CALLING', params)
    return await promisfy(api.make_call)(params);
  }
};
