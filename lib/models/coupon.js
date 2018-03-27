'use strict'

const Redemption = require('./redemption')
const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})
const debug = require('debug')('recurring')

class Coupon extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'applies_for_months',
        'applies_to_all_plans',
        'applies_to_non_plan_charges',
        'coupon_code',
        'coupon_type',
        'created_at',
        'description',
        'discount_percent',
        'discount_type',
        'discount_in_cents',
        'duration',
        'free_trial_amount',
        'free_trial_unit',
        'invoice_description',
        'max_redemptions',
        'max_redemptions_per_account',
        'name',
        'plan_codes',
        'redeem_by_date',
        'redemption_resource',
        'redemptions',
        'single_use',
        'state',
        'temporal_amount',
        'temporal_unit',
        'unique_code_template'
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

  static get validCouponTypes() {
    return [ 'single_code', 'bulk' ]
  }

  static get validDiscountTypes() {
    return [ 'percent', 'dollars', 'free_trial' ]
  }

  static get validDurations() {
    return [ 'forever', 'single_use', 'temporal' ]
  }

  static get validFreeTrialUnits() {
    return [ 'day', 'week', 'month' ]
  }

  static get validTemporalUnits() {
    return [ 'day', 'week', 'month', 'year' ]
  }

  static get validRedemptionResources() {
    return [ 'account', 'subscription' ]
  }

  get href() {
    return `${this.constructor.ENDPOINT}/${this.coupon_code}`
  }

  set href(val) {
    return val
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
    if (options.coupon_type && Coupon.validCouponTypes.indexOf(options.coupon_type) === -1) {
      throw (new Error(`coupon_type must be one of ${JSON.stringify(Coupon.validCouponTypes)}`))
    }
    if (options.discount_type && Coupon.validDiscountTypes.indexOf(options.discount_type) === -1) {
      throw (new Error(`discount_type must be one of ${JSON.stringify(Coupon.validDiscountTypes)}`))
    }
    if (options.duration && Coupon.validDurations.indexOf(options.duration) === -1) {
      throw (new Error(`duration must be one of ${JSON.stringify(Coupon.validDurations)}`))
    }
    if (options.free_trial_unit && Coupon.validFreeTrialUnits.indexOf(options.free_trial_unit) === -1) {
      throw (new Error(`free_trial_unit must be one of ${JSON.stringify(Coupon.validFreeTrialUnits)}`))
    }
    if (options.temporal_unit && Coupon.validTemporalUnits.indexOf(options.temporal_unit) === -1) {
      throw (new Error(`temporal_unit must be one of ${JSON.stringify(Coupon.validTemporalUnits)}`))
    }
    if (options.redemption_resource && Coupon.validRedemptionResources.indexOf(options.redemption_resource) === -1) {
      throw (new Error(`redemption_resource must be one of ${JSON.stringify(Coupon.validRedemptionResources)}`))
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
    debug('calling redeem with options: %o', options)
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
