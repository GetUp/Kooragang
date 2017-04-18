const moment = require('moment');

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
  return !(callback || entry === "more_info" || !campaign_passcode || authenticated);
};

module.exports.withinDailyTimeOfOperation = campaign => {
  const start = moment(campaign.daily_start_operation, 'HHmm')
  const stop = moment(campaign.daily_stop_operation, 'HHmm')
  return moment().isBetween(start, stop, null, '[]')
}

module.exports.dailyTimeOfOperationInWords = campaign => {
  const start = moment(campaign.daily_start_operation, 'HHmm').format('h mm a').replace(/00\s/,'')
  const stop = moment(campaign.daily_stop_operation, 'HHmm').format('h mm a').replace(/00\s/,'')
  return `Please call back within the hours of ${start}, and ${stop}.`
}
