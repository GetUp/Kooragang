const _ = require('lodash')
const { Log } = require("../../models")
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError
} = require("./errors")

const wrap = fn => (...args) => fn(...args).catch(args[2])

const log = async ({ method, url, body, query, params, headers }, res, next) => {
  await Log.query().insert({ url, body, query, params, headers })
  if (process.env.NODE_ENV !== 'development') return next()

  console.log('~~~ API REQUEST > ', { method, url, body, query, params })
  let oldWrite = res.write,
    oldEnd = res.end,
    chunks = []
  res.write = function (chunk) {
    chunks.push(chunk)
    oldWrite.apply(res, arguments)
  }
  res.end = function (chunk) {
    if (chunk) chunks.push(chunk)
    var body = Buffer.concat(chunks).toString('utf8')
    console.log('~~~ API RESPONSE > ', { body })
    oldEnd.apply(res, arguments)
  }
  next()
}

const cors_options = {
  allowedHeaders: ['Content-Type', 'authorization']
}

const headers = (req, res, next) => {
  req.accepts('json')
  res.type('json')
  next()
}
const unauthenticatedEndpoints = [
  '/api/calls_count_today',
  '/api/campaigns_public',
  '/api/campaigns/.*?/outbound_caller',
]
const isValidUnauthenticatedEndpoint = (url) => {
  return _.find(unauthenticatedEndpoints, (endpoint) => {
    const pattern = new RegExp(endpoint.value)
    return pattern.test(url);
  })
}
const authentication = (req, res, next) => {
  if (isValidUnauthenticatedEndpoint(req.url)) return next()
  const token = req.headers['authorization']
  if (token) {
    if (token === process.env.KOORAGANG_API_HASH) {
      next()
    } else {
      next(new UnauthorizedError('Failed to authenticate token.'))
    }
  } else {
    next(new UnauthorizedError('No authentication token provided.'))
  }
}

const error_handler = (err, req, res, _next) => {
  const returned_error = { errors: { message: err.message || err } }
  switch (err.constructor) {
    case BadRequestError:
      returned_error.errors.type = "Bad Request"
      res.status(400)
      break
    case UnauthorizedError:
      returned_error.errors.type = "Unauthorized"
      res.status(401)
      break
    case NotFoundError:
      returned_error.errors.type = "Not Found"
      res.status(404)
      break
    default:
      returned_error.errors.type = "Internal Server Error"
      res.status(500)
  }
  console.error(res.statusCode + " " + returned_error.errors.type)
  if (err.stack) console.error(err.stack)
  return res.json(returned_error)
}

module.exports = {
  wrap,
  log,
  cors_options,
  headers,
  authentication,
  error_handler
}
