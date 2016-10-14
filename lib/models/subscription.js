'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const querystring = require('querystring')
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class Subscription extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'account',
        'activated_at',
        'bank_account_authorized_at',
        'canceled_at',
        'collection_method',
        'currency',
        'current_period_ends_at',
        'current_period_started_at',
        'customer_notes',
        'expires_at',
        'href',
        'net_terms',
        'plan',
        'quantity',
        'state',
        'subscription_add_ons',
        'tax',
        'tax_in_cents',
        'tax_type',
        'tax_region',
        'tax_rate',
        'terms_and_conditions',
        'trial_ends_at',
        'trial_started_at',
        'unit_amount_in_cents',
        'uuid',
        'pending_subscription',
        'po_number'
      ],
      idField: 'uuid',
      plural: 'subscriptions',
      singular: 'subscription',
      enumerable: true
    })

    this.__defineGetter__('account_id', () => {
      if (this._account_id) {
        return this._account_id
      }
      if (!this._resources.account) {
        return undefined
      }

      // The account property points to a hash with an href that can be used to fetch
      // the account, but sometimes I want the id.
      this._account_id = this._resources.account.match(/\/([^\/]*)$/)[1]
      return this._account_id
    })
  }

  static get SINGULAR() {
    return 'subscription'
  }

  static get PLURAL() {
    return 'subscriptions'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Subscription.PLURAL}`
  }

  static get validRefundTypes() {
    return [ 'partial', 'full', 'none' ]
  }

  create(options, callback) {
    if (!options.plan_code) {
      throw (new Error('subscription must include "plan_code" parameter'))
    }
    if (!options.account) {
      throw (new Error('subscription must include "account" information'))
    }
    if (!options.account.account_code) {
      throw (new Error('subscription account info must include "account_code"'))
    }
    if (!options.currency) {
      throw (new Error('subscription must include "currency" parameter'))
    }

    const body = data2xml(Subscription.SINGULAR, options)
    this.post(Subscription.ENDPOINT, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  update(options, callback) {
    if (!options.timeframe) {
      throw (new Error('subscription update must include "timeframe" parameter'))
    }
    if (!this.href) {
      throw (new Error(`cannot update a subscription without an href ${this.id}`))
    }

    const body = data2xml(Subscription.SINGULAR, options)

    this.put(this.href, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  cancel(callback) {
    if (!this.id) {
      throw (new Error('cannot cancel a subscription without a uuid'))
    }

    let href
    if (this.a && this.a.cancel) {
      href = this.a.cancel.href
    }
    else {
      href = `${Subscription.ENDPOINT}/${this.id}/cancel`
    }

    this.put(href, '', (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  reactivate(callback) {
    if (!this.id) {
      throw (new Error('cannot reactivate a subscription without a uuid'))
    }

    let href
    if (this.a && this.a.reactivate) {
      href = this.a.reactivate.href
    }
    else {
      href = `${Subscription.ENDPOINT}/${this.id}/reactivate`
    }

    this.put(href, '', (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  postpone(nextRenewal, callback) {
    if (!this.id) {
      throw (new Error('cannot postpone a subscription without a uuid'))
    }
    if (!nextRenewal || (typeof nextRenewal !== 'object')) {
      throw (new Error(`${nextRenewal} must be a valid renewal date`))
    }

    let href
    if (this.a && this.a.postpone) {
      href = this.a.postpone.href
    }
    else {
      href = `${Subscription.ENDPOINT}/${this.id}/postpone`
    }

    const query = { next_renewal_date: nextRenewal.toISOString() }
    href += `?${querystring.stringify(query)}`

    this.put(href, '', (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  terminate(refundType, callback) {
    if (!this.id) {
      throw (new Error('cannot terminate a subscription without a uuid'))
    }
    if (Subscription.validRefundTypes.indexOf(refundType) === -1) {
      throw (new Error(`refund type ${refundType} not valid`))
    }

    let href
    if (this.a && this.a.terminate) {
      href = this.a.terminate.href
    }
    else {
      href = `${Subscription.ENDPOINT}/${this.id}/terminate`
    }

    const query = { refund: refundType }
    href += `?${querystring.stringify(query)}`

    this.put(href, '', (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }
}

module.exports = Subscription
