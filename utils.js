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
  if (query.callback === '1' || query.test === '1') {
    return query.number;
  } else {
    const sip = body.From.match(/sip:(\w+)@/);
    return sip ? sip[1] : body.From.replace(/\s/g, '').replace(/^0/, '61');
  }
};

const cleanNumber = number => number.replace(/[^\d]/g, '')

module.exports.sipFormatNumber = number => {
  const cleanedNumber = cleanNumber(number)
  if(process.env.OUTBOUND_SIP_SERVER && !cleanedNumber.match(/^sip:/)) {
    return `sip:${cleanedNumber}@${process.env.OUTBOUND_SIP_SERVER}`
  }
  return cleanedNumber
}

module.exports.extractDialInNumber = body => {
  const dialInNumber = body.Direction === 'outbound' ? body.From : body.To
  if (!sipHeaderPresent(body)) return dialInNumber

  if (body['SIP-H-To'].match(/phone=(\w+)\D/)) {
    return body['SIP-H-To'].match(/phone=(\w+)\D/)[1]
  }
  if (body['SIP-H-To'].match(/sip:(\w+)\D/)) {
    return body['SIP-H-To'].match(/sip:(\w+)\D/)[1]
  }
  return dialInNumber
}

const sipHeaderPresent = module.exports.sipHeaderPresent = (body) => !!body['SIP-H-To']

module.exports.incomingCaller = (body) => body.Direction == 'inbound'

module.exports.authenticationNeeded = (callback, campaign_passcode, authenticated) => {
  return !(callback || !campaign_passcode || authenticated);
};

module.exports.isValidCallerNumber = (caller_number) => {
  return !_.isEmpty(caller_number) && caller_number !== 'anonymous' && caller_number !== 'undefined'
};

module.exports.modelsBoundReadOnly = _.partialRight(_.mapValues, m => m.bindReadOnly() )
