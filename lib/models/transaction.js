'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const querystring = require('querystring')
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class Transaction extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'account',
        'action',
        'amount_in_cents',
        'avs_result',
        'avs_result_postal',
        'avs_result_street',
        'created_at',
        'currency',
        'cvv_result',
        'details',
        'href',
        'invoice',
        'ip_address',
        'payment_method',
        'recurring',
        'reference',
        'refundable',
        'source',
        'status',
        'subscription',
        'tax_in_cents',
        'test',
        'type',
        'uuid',
        'voidable'
      ],
      idField: 'uuid',
      plural: 'transactions',
      singular: 'transaction',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'transaction'
  }

  static get PLURAL() {
    return 'transactions'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Transaction.PLURAL}`
  }

  create(options, callback) {
    if (!options.account) {
      throw (new Error('transaction must include "account" parameter'))
    }
    if (!options.account.account_code) {
      throw (new Error('"account" parameter must specify account_code'))
    }
    if (!options.amount_in_cents) {
      throw (new Error('transaction must include "amount_in_cents" parameter'))
    }
    if (!options.currency) {
      throw (new Error('transaction must include "currency" parameter'))
    }

    const body = data2xml(Transaction.SINGULAR, options)
    this.post(Transaction.ENDPOINT, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  refund(amount, callback) {
    if (typeof amount === 'function') {
      callback = amount
      amount = null
    }

    if (!this.id) {
      throw (new Error('cannot refund a transaction without an id'))
    }

    let href
    if (this.a && this.a.refund) {
      href = this.a.refund.href
    }
    else {
      href = this.href
    }

    if (amount) {
      const query = { amount_in_cents: amount }
      href += `?${querystring.stringify(query)}`
    }

    this.destroy(href, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 202 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }
}

module.exports = Transaction
