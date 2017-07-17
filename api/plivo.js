const plivo = require('plivo')
const promisify = require('es6-promisify')
const api = plivo.RestAPI({ authId: process.env.PLIVO_API_ID || 'test', authToken: process.env.PLIVO_API_TOKEN || 'test'})

module.exports.plivo_signature = api.middleware({host: process.env.BASE_URL})

module.exports.plivo_api = (endpoint, params, options) => {
  return promisify(api[endpoint].bind(api), options)(params)
}
