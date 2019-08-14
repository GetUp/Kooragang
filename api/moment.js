const moment = require('moment-timezone')
const timezone = process.env.TZ

if (timezone) moment.tz.setDefault(timezone)

const timezone_abbreviations = {
  AWST: 'Australian Western Standard Time',         //UTC+8:00
  ACWS: 'Australian Central Western Standard Time', //UTC+8:45
  ACST: 'Australian Central Standard Time',         //UTC+9:30
  AEST: 'Australian Eastern Standard Time',         //UTC+10:00
  LHST: 'Lord Howe Standard Time',                  //UTC+10:30
  ACDT: 'Australian Central Daylight Time',         //UTC+10:30
  AEDT: 'Australian Eastern Daylight Time',         //UTC+11:00
  LHDT: 'Lord Howe Daylight Time',                  //UTC+11:00
}

moment.fn.zoneName = function () {
    var timezone_abbreviation = this.zoneAbbr()
    return timezone_abbreviations[timezone_abbreviation] || timezone_abbreviation
}

module.exports = moment
