const plivo = require('plivo')
const promisify = require('es6-promisify')
const api = plivo.RestAPI({ authId: process.env.API_ID || 'test', authToken: process.env.API_TOKEN || 'test'})

module.exports = (endpoint, params, options) => {
  return promisify(api[endpoint].bind(api), options)(params)
}
