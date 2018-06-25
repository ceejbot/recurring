'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class Plan extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'accounting_code',
        'add_ons',
        'bypass_hosted_confirmation',
        'cancel_url',
        'created_at',
        'description',
        'display_donation_amounts',
        'display_phone_number',
        'display_quantity',
        'name',
        'payment_page_tos_link',
        'plan_code',
        'plan_interval_length',
        'plan_interval_unit',
        'revenue_schedule_type',
        'setup_fee_revenue_schedule_type',
        'setup_fee_accounting_code',
        'setup_fee_in_cents',
        'success_url',
        'total_billing_cycles',
        'trial_interval_length',
        'trial_interval_unit',
        'trial_requires_billing_info',
        'unit_amount_in_cents',
        'unit_name',
        'updated_at'
      ],
      idField: 'plan_code',
      plural: 'plans',
      singular: 'plan',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'plan'
  }

  static get PLURAL() {
    return 'plans'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Plan.PLURAL}`
  }

  fetchAddOns(callback) {
    if (this._addons) {
      return callback(null, this._addons)
    }

    const uri = `${Plan.ENDPOINT}/${this.id}/add_ons`

    this.fetchAll('Addon', uri, (err, results) => {
      if (err) {
        return callback(err)
      }

      this._addons = results.reduce((acc, addon) => {
        acc[addon.add_on_code] = addon
        return acc
      }, {})
      callback(null, this._addons)
    })
  }

  create(options, callback) {
    if (!options.plan_code) {
      throw (new Error('plan options must include "plan_code" parameter'))
    }
    if (!options.name) {
      throw (new Error('plan options must include "name" parameter'))
    }
    if (!options.unit_amount_in_cents) {
      throw (new Error('plan options must include "unit_amount_in_cents" parameter'))
    }

    const body = data2xml(Plan.SINGULAR, options)
    this.post(Plan.ENDPOINT, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  update(options, callback) {
    if (!this.href) {
      throw (new Error(`cannot update a plan without an href ${this.id}`))
    }

    const body = data2xml(Plan.SINGULAR, options)

    this.put(this.href, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }
}

module.exports = Plan
