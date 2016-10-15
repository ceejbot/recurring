'use strict'

const RecurlyError = require('./recurly-error')

const handleRecurlyError = (err, response, payload, validStatuses) => {
  let recurlyError = null

  if (err) {
    return err
  }
  else if (!response) {
    recurlyError = new Error('no response object')
  }
  else if (payload && payload.hasOwnProperty('transaction_error')) {
    recurlyError = new RecurlyError(payload)
  }
  else if (payload && payload.hasOwnProperty('error')) {
    recurlyError = new RecurlyError(payload.error)
  }
  else if ((response.statusCode === 400) && payload && (typeof payload === 'object')) {
    recurlyError = new RecurlyError(payload)
  }

  if (recurlyError) {
    recurlyError.statusCode = response.statusCode
    return recurlyError
  }

  if (validStatuses.indexOf(response.statusCode) === -1) {
    return new Error(`unexpected status: ${response.statusCode}`)
  }
}

module.exports.handleRecurlyError = handleRecurlyError
