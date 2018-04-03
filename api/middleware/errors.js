class BaseError extends Error {
  constructor(message) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
    this.message = message
  }
}
class BadRequestError extends BaseError {}
class UnauthorizedError extends BaseError {}
class NotFoundError extends BaseError {}
class NoNumbersError extends BaseError {}

module.exports = {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  NoNumbersError
}
