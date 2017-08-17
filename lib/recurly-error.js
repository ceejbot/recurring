'use strict'

const _ = require('lodash')
const util = require('util')
const debug = require('debug')('recurring:error')

const RecurlyError = function RecurlyError(struct) {
  debug('constructing RecurlyError from %O', struct)

  this.name = 'RecurlyError'

  this.errors = [ ]
  if (typeof struct === 'string') {
    this.message = struct
  }
  // Handle transaction errors.
  if (struct.transaction_error) {
    // massage the output a little bit.
    struct.error.message = struct.error['#']
    delete struct.error['#']
    // Add the error detail.
    this.errors.push(struct.error)

    // Add extra detail about the error.
    this.message = struct.transaction_error.merchant_message
    this.error_code = struct.transaction_error.error_code
    this.error_category = struct.transaction_error.error_category
    this.merchant_message = struct.transaction_error.merchant_message
    this.customer_message = struct.transaction_error.customer_message
    this.gateway_error_code = struct.transaction_error.gateway_error_code
  }
  // Handle the case where there is a single validation error.
  else if (struct.symbol) {
    // massage the output a little bit...

    // {
    //   symbol: 'not_found',
    //   description: {
    //     '#': 'Couldn\'t find Account with account_code = some-invalid-id',
    //     lang: 'en-US'
    //   }
    // }
    if (struct.symbol === 'not_found') {
      this.message = _.get(struct, 'description.#')
      this.error_code = 'not_found'
      delete struct.description
    }

    // { '#': 'is not a valid email address',
    //   field: 'account.email',
    //   symbol: 'invalid_email'
    // }
    else {
      struct.message = struct['#'] || struct.message
      this.message = [ struct.field, struct.message ].join(' ')
      delete struct['#']
    }

    this.errors.push(struct)
  }
  // Handle case where there are multiple validation errors.
  else {
    const keys = Object.keys(struct)
    for (let i = 0; i < keys.length; i++) {
      // massage the output a little bit.
      const err = struct[keys[i]]
      err.message = err['#']
      delete err['#']
      this.errors.push(err)
    }

    if (this.errors.length === 1) {
      this.message = this.errors[0].message
    }
    else {
      this.message = `${this.errors.length} validation errors`
    }
  }
  debug('constructed RecurlyError', this)
}

util.inherits(RecurlyError, Error)

module.exports = RecurlyError
