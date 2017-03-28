module.exports.sleep = (ms = 0) => {
  const timeout = process.env.NODE_ENV === "test" ? 0 : ms;
  return new Promise(r => setTimeout(r, timeout));
}

module.exports.extractCallerNumber = (query, body) => {
  if (query.callback) {
    return query.number;
  } else {
    const sip = body.From.match(/sip:(\w+)@/);
    return sip ? sip[1] : body.From.replace(/\s/g, '').replace(/^0/, '61');
  }
};

module.exports.authenticationNeeded = (callback, entry, campaign_passcode, authenticated) => {
  if (callback) { return false };
  if (entry === "more_info") { return false }
  if (!campaign_passcode) { return false };
  if (authenticated) { return false };
  return true;
};

module.exports.introductionNeeded = (entry) => {
  if (entry === "more_info") { return false };
  return true;
};

module.exports.validPasscode = (campaign_passcode, digits) => {
  return campaign_passcode === digits;
};
