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

const call = async (host) =>
  const cleanedNumber = '\'61\' || right(regexp_replace(phone_number, \'[^\\\d]\', \'\', \'g\'),9)';
  const calleeTransaction = await transaction.start(Callee.knex());
  const callee = await Callee.query()
    .bindTransaction(calleeTransaction)
    .whereRaw(`length(${cleanedNumber}) = 11`)
    .whereNull('last_called_at')
    .orderBy('id')
    .first();
  if (!callee) {
    // update campaign
    return await calleeTransaction.commit();
  }else{
    await Callee.query()
      .bindTransaction(calleeTransaction)
      .patchAndFetchById(callee.id, {last_called_at: new Date})
    await calleeTransaction.commit();
    const params = {
      to: callee.phone_number,
      from : '1111111111',
      answer_url : `${host}/answer?name=${callee.first_name}&callee_id=${callee.id}`,
      hangup_url : `${host}/hangup?callee_id=${callee.id}`,
      fallback_url : `${host}/log?callee_id=${callee.id}`,
      time_limit: 10 * 60,
      ring_timeout: 30
    };
    return await promisfy(api.make_call)(params);
  }
};
