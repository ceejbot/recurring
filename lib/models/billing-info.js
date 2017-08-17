'use strict'

const Account = require('./account')
const RecurlyData = require('../recurly-data')
const _ = require('lodash')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class BillingInfo extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'account',
        'address1',
        'address2',
        'card_type',
        'city',
        'company',
        'country',
        'first_name',
        'first_six',
        'href',
        'ip_address',
        'ip_address_country',
        'last_four',
        'last_name',
        'month',
        'paypal_billing_agreement_id',
        'phone',
        'state',
        'vat_number',
        'year',
        'zip'
      ],
      idField: 'add_on_code',
      plural: 'billing_info',
      singular: 'billing_info'
    })

    this.__defineGetter__('account_code', () => {
      return this.account_code
    })

    this.__defineSetter__('account_code', accountCode => {
      this.properties.account_code = accountCode
      if (!this.href) {
        this.href = `${Account.ENDPOINT}/${accountCode}/billing_info`
      }
    })
  }

  static get SINGULAR() {
    return 'billing_info'
  }

  static get PLURAL() {
    return 'billing_info'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${BillingInfo.PLURAL}`
  }

  update(options, callback) {
    if (!options.token_id) {
      if (!options.first_name) {
        throw (new Error('billing info must include "first_name" parameter'))
      }
      if (!options.last_name) {
        throw (new Error('billing info must include "last_name" parameter'))
      }
      if (!options.number) {
        throw (new Error('billing info must include "number" parameter'))
      }
      if (!options.month) {
        throw (new Error('billing info must include "month" parameter'))
      }
      if (!options.year) {
        throw (new Error('billing info must include "year" parameter'))
      }
    }

    const extraOpts = { }
    if (this.skipAuthorization) {
      _.set(extraOpts, 'headers.Recurly-Skip-Authorization', true)
    }

    if (!this.href) {
      throw (new Error('must set an account_code that this billing info belongs to'))
    }

    const body = data2xml(BillingInfo.SINGULAR, options)
    this.put(this.href, body, extraOpts, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }
      this.inflate(payload)
      callback(null, this)
    })
  }
}

module.exports = BillingInfo
