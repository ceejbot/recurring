'use strict'

const Redemption = require('./redemption')
const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class Coupon extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'applies_for_months',
        'applies_to_all_plans',
        'coupon_code',
        'created_at',
        'discount_percent',
        'discount_type',
        'max_redemptions',
        'name',
        'plan_codes',
        'redeem_by_date',
        'redemptions',
        'single_use',
        'state'
      ],
      idField: 'coupon_code',
      plural: 'coupons',
      singular: 'coupon',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'coupon'
  }

  static get PLURAL() {
    return 'coupons'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Coupon.PLURAL}`
  }

  static get validDiscountTypes() {
    return [ 'percent', 'dollars' ]
  }

  create(options, callback) {
    if (!options.coupon_code) {
      throw (new Error('coupon options must include "coupon_code" parameter'))
    }
    if (!options.name) {
      throw (new Error('coupon options must include "name" parameter'))
    }
    if (!options.discount_type) {
      throw (new Error('coupon options must include "discount_type" parameter'))
    }
    if (Coupon.validDiscountTypes.indexOf(options.discount_type) === -1) {
      throw (new Error(`discount_type must be one of ${JSON.stringify(Coupon.validDiscountTypes)}`))
    }

    if (options.hasOwnProperty('applies_to_all_plans') && !options.applies_to_all_plans) {
      // Defaults to true. If it's false, plan_codes must be an array.
      if (!options.plan_codes && !Array.isArray(options.plan_codes)) {
        throw (new Error('coupons that do not apply to all plans must specify plan_codes'))
      }
    }

    const body = data2xml(Coupon.SINGULAR, options)

    this.post(Coupon.ENDPOINT, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  redeem(options, callback) {
    if (!options.account_code) {
      throw (new Error('coupon redemption options must include "account_code" parameter'))
    }
    if (!options.currency) {
      throw (new Error('coupon redemption options must include "currency" parameter'))
    }

    const body = data2xml(Redemption.SINGULAR, options)
    const href = `${this.href}/redeem`

    this.post(href, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      const redemption = this._recurring.Redemption()
      redemption.inflate(payload)
      callback(null, redemption)
    })
  }
}

module.exports = Coupon
