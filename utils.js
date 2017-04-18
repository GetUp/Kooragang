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
  const todayDateString = moment().format('Y-MM-DD');
  const todayStartOperation = moment(todayDateString+' '+campaign.daily_start_operation);
  const todayStopOperation = moment(todayDateString+' '+campaign.daily_stop_operation);
  if (!moment.isMoment(todayStartOperation) || !moment.isMoment(todayStopOperation)){ return true };
  return moment().isBetween(todayStartOperation, todayStopOperation, null, '[]');
}

module.exports.dailyTimeOfOperationInWords = campaign => {
  const todayDateString = moment().format('Y-MM-DD');
  const todayStartOperation = moment(todayDateString+' '+campaign.daily_start_operation);
  const todayStartOperationFormatString = todayStartOperation.format("mm") === "00" ? "h a" : "h mm a";
  const todayStopOperation = moment(todayDateString+' '+campaign.daily_stop_operation);
  const todayStopOperationFormatString = todayStopOperation.format("mm") === "00" ? "h a" : "h mm a";

  if (!moment.isMoment(todayStartOperation) || !moment.isMoment(todayStopOperation)){ return null };
  operatingHoursPhrasing = 'Please call back within the hours of ';
  operatingHoursPhrasing += todayStartOperation.format(todayStartOperationFormatString);
  operatingHoursPhrasing += ', and ';
  operatingHoursPhrasing += todayStopOperation.format(todayStopOperationFormatString);
  operatingHoursPhrasing += '.';
  return operatingHoursPhrasing;
}
