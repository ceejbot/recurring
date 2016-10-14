'use strict'

const Adjustment = require('./adjustment')
const RecurlyData = require('../recurly-data')
const _ = require('lodash')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class Account extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'accept_language',
        'account_code',
        'created_at',
        'email',
        'first_name',
        'last_name',
        'state',
        'username'
      ],
      idField: 'account_code',
      plural: 'accounts',
      singular: 'account',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'account'
  }

  static get PLURAL() {
    return 'accounts'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Account.PLURAL}`
  }

  create(data, callback) {
    // Save this new account with recurly.
    if (data.id) {
      data.account_code = data.id
      delete data.id
    }

    if (!data.account_code) {
      throw (new Error('you must supply an id or account_code for new accounts'))
    }

    // TODO optional BillingInfo object

    const body = data2xml(Account.SINGULAR, data)

    this.post(Account.ENDPOINT, body, (err, response, payload) => {
      let error = handleRecurlyError(err, response, payload, [ 201, 422 ])
      if (error && (response.statusCode !== 422)) {
        return callback(error)
      }

      const account = this._recurring.Account()
      account.id = data.account_code

      if (response.statusCode === 201) {
        // Account created as normal.
        this.inflate(payload)
        return callback(null, this)
      }

      if (response.statusCode === 422) {
        // An account with this ID exists already but in closed state. Reopen it.
        if (_.get(payload, '.error.symbol') === 'taken' && _.get(payload, '.error.field') === 'account.account_code') {
          return account.reopen(callback)
        }
        // Otherwise, rethrow the original error.
        else {
          error = handleRecurlyError(err, response, payload, [ 201 ])
          return callback(error)
        }
      }

      callback(new Error(`unexpected status: ${response.statusCode}`))
    })
  }

  close(callback) {
    return this.destroy(callback)
  }

  reopen(callback) {
    this.put(`${this.href}/reopen`, null, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }
      this.inflate(payload)
      callback(null, this)
    })
  }

  update(callback) {
    const newData = {
      username: this.username,
      email: this.email,
      first_name: this.first_name,
      last_name: this.last_name,
      company_name: this.company_name,
      accept_language: this.accept_language
    }

    if (this.billing_info) {
      newData.billing_info = this.billing_info
    }

    const body = data2xml(Account.SINGULAR, newData)

    this.put(this.href, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  createAdjustment(opts, callback) {
    const uri = `${this.href}/adjustments`
    const body = data2xml(Adjustment.SINGULAR, opts)
    this.post(uri, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }
      callback(null, payload)
    })
  }

  createInvoice(callback) {
    const uri = `${this.href}/invoices`
    this.post(uri, null, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }
      callback(null, payload)
    })
  }

  fetchTransactions(callback) {
    const uri = this._resources.transactions || (`${this.href}/transactions`)
    this.fetchAll('Transaction', uri, (err, results) => {
      if (err) {
        return callback(err)
      }
      this.transactions = results
      callback(null, this.transactions)
    })
  }

  fetchSubscriptions(callback) {
    const uri = this._resources.subscriptions || (`${this.href}/subscriptions`)
    this.fetchAll('Subscription', uri, (err, results) => {
      if (err) {
        return callback(err)
      }
      this.subscriptions = results
      callback(null, this.subscriptions)
    })
  }

  fetchInvoices(callback) {
    const uri = this._resources.invoices || (`${this.href}/invoices`)
    this.fetchAll('Invoice', uri, (err, results) => {
      if (err) {
        return callback(err)
      }
      this.invoices = results
      callback(null, this.invoices)
    })
  }

  fetchBillingInfo(callback) {
    const binfo = this._recurring.BillingInfo()
    binfo.account_code = this.id
    binfo.fetch(err => {
      if (err) {
        return callback(err)
      }
      this.billingInfo = binfo
      callback(null, this.billingInfo)
    })
  }

  fetchRedeemedCoupons(callback) {
    const rinfo = this._recurring.Redemption()
    rinfo.account_code = this.id
    rinfo.fetch(err => {
      if (err) {
        return callback(err)
      }
      this.redeemedInfo = rinfo
      callback(null, this.redeemedInfo)
    })
  }
}

module.exports = Account
