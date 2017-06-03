const api_config = require("../config")
const { Log } = require("../../models")
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError
} = require("./errors")

const wrap = fn => (...args) => fn(...args).catch(args[2])

const log = async ({url, body, query, params, headers}, res, next) => {
  await Log.query().insert({UUID: null, url, body, query, params, headers})
  next()
}

const headers = (req, res, next) => {
  req.accepts('json')
  res.type('json')
  next()
}

const authentication = (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-access-token']
  if (token) { 
    if (token === api_config.hash) {
      next()
    } else {
      return next(new UnauthorizedError('Failed to authenticate token.'))
    }
  } else {
    return next(new UnauthorizedError('No authentication token provided.'))
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
  headers,
  authentication,
  error_handler
}
