'use strict'

const RecurlyData = require('../recurly-data')
const _ = require('lodash')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})
const debug = require('debug')('recurring')

class Invoice extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'account',
        'address',
        'adjustment',
        'all_line_items',
        'attempt_next_collection_at',
        'created_at',
        'closed_at',
        'currency',
        'customer_notes',
        'collection_method',
        'invoice_number',
        'invoice_number_prefix',
        'line_items',
        'net_terms',
        'po_number',
        'recovery_reason',
        'shipping_address',
        'state',
        'subtotal_after_discount_in_cents',
        'subtotal_in_cents',
        'tax_in_cents',
        'terms_and_conditions',
        'total_in_cents',
        'transactions',
        'updated_at',
        'uuid',
        'vat_number'
      ],
      idField: 'uuid',
      plural: 'invoices',
      singular: 'invoice',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'invoice'
  }

  static get PLURAL() {
    return 'invoices'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Invoice.PLURAL}`
  }

  fetchPDF(callback) {
    if (!this.href) {
      throw new Error('cannot fetch a record without an href')
    }

    this.get(
      this.href,
      {},
      {
        headers: {
          Accept: 'application/pdf'
        },
        encoding: null,
        noParse: true
      },
      (err, response, payload) => {
        if (err) {
          return callback(err)
        }
        if (response.statusCode === 404) {
          return callback(new Error('not_found'))
        }

        callback(err, payload)
      }
    )
  }

  refund(options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = null
    }

    options = _.defaults(
      {
        amount_in_cents: undefined,
        refund_method: undefined
      },
      options,
      { refund_method: 'credit_first' }
    )

    debug('Got options as %o', options)

    let uri = _.get(this, 'a.refund.href')
    if (!uri && !this.invoice_number) {
      throw new Error('cannot refund an invoice without an invoice_number')
    }

    uri = uri || `${Invoice.ENDPOINT}/${this.invoice_number}/refund`
    const body = data2xml(Invoice.SINGULAR, options)

    debug('Calling refund uri %s with body %o', uri, body)

    this.post(uri, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [201])
      if (error) {
        return callback(error)
      }
      this.inflate(payload)
      callback(null, this)
    })
  }

  markSuccessful(callback) {
    let uri = _.get(this, 'a.mark_successful.href')
    if (!uri && !this.invoice_number) {
      throw new Error(
        'cannot mark invoice as successful without an invoice_number'
      )
    }

    uri = uri || `${Invoice.ENDPOINT}/${this.invoice_number}/mark_successful`

    this.put(uri, null, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [200])
      if (error) {
        return callback(error)
      }
      this.inflate(payload)
      callback(null, this)
    })
  }

  markFailed(callback) {
    let uri = _.get(this, 'a.mark_failed.href')
    if (!uri && !this.invoice_number) {
      throw new Error('cannot mark invoice as failed without an invoice_number')
    }

    uri = uri || `${Invoice.ENDPOINT}/${this.invoice_number}/mark_failed`

    this.put(uri, null, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [200])
      if (error) {
        return callback(error)
      }
      this.inflate(payload)
      callback(null, this)
    })
  }
}

module.exports = Invoice
