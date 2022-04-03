const plivo = require('plivo')
const promisify = require('es6-promisify')
const api = plivo.RestAPI({ authId: process.env.PLIVO_API_ID || 'test', authToken: process.env.PLIVO_API_TOKEN || 'test'})

let callback_base_url = process.env.PLIVO_CALLBACK_BASE_URL || process.env.BASE_URL

module.exports.get_callback_base_url = () => { return callback_base_url }
module.exports.set_callback_base_url = (url) => { callback_base_url = url }

module.exports.plivo_signature = api.middleware({host: process.env.BASE_URL})

module.exports.plivo_api = (endpoint, params, options) => {
  return promisify(api[endpoint].bind(api), options)(params)
}
