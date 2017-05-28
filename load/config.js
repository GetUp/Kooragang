const _ = require('lodash');

const default_config = {
  text: {
    ivr: {
      welcome: "Hi! Welcome to the GetUp Dialer tool.",
      technical_staff_notified: 'GetUp technical staff have been notified. Hanging up now.'
    }
  }
};

// Anything in the org-specific config will take precedence over the general
const org_config = {}
org_config['38degrees'] = {
  text: {
    ivr: {
      welcome: "Hi! Welcome to the 38 Degrees dialling tool."
    }
  }
}

function config(org = ''){
  return _.merge(_.cloneDeep(default_config), org_config[org])
}

module.exports = config;