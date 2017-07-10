class BaseError extends Error {
  constructor(message) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
    this.name = this.constructor.name
    this.message = message
  }
}
class ForbiddenError extends BaseError {}

module.exports = {
  ForbiddenError
}
