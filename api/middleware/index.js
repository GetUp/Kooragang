const express_cors = require('cors')
const { Log } = require("../../models")
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError
} = require("./errors")

const wrap = fn => (...args) => fn(...args).catch(args[2])

const log = async ({url, body, query, params, headers}, res, next) => {
  await Log.query().insert({url, body, query, params, headers})
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

const authentication = (req, res, next) => {
  const token = req.headers['authorization']
  if (token) {
    if (token === process.env.KOORAGANG_API_HASH || (req.method == 'GET' && token === process.env.KOORAGANG_READONLY_API_HASH)) {
      next()
    } else {
      next(new UnauthorizedError('Failed to authenticate token.'))
    }
  } else {
    next(new UnauthorizedError('No authentication token provided.'))
  }
}

const error_handler = (err, req, res, next) => {
  console.error(err.stack)
  const returned_error = {errors: {message: err.message}}
  switch(err.constructor) {
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
