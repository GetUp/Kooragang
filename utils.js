const moment = require('moment');
const _ = require('lodash');

module.exports.sleep = (ms = 0) => {
  const timeout = process.env.NODE_ENV === "test" ? 0 : ms;
  return new Promise(r => setTimeout(r, timeout));
}

module.exports.error_exit = error => {
  console.error(error)
  process.exit(1)
}

module.exports.extractCallerNumber = (query, body) => {
  if (query.callback === '1') {
    return query.number;
  } else {
    const sip = body.From.match(/sip:(\w+)@/);
    return sip ? sip[1] : body.From.replace(/\s/g, '').replace(/^0/, '61');
  }
};

module.exports.authenticationNeeded = (callback, campaign_passcode, authenticated) => {
  return !(callback || !campaign_passcode || authenticated);
};

module.exports.isValidCallerNumber = (caller_number) => {
  return !_.isEmpty(caller_number) && caller_number !== 'anonymous' && caller_number !== 'undefined'
};
