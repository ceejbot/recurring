'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})

class AddonUsage extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'id',
        'subscription_uuid',
        'add_on_code',
        'measured_unit',
        'amount',
        'merchant_tag',
        'recording_timestamp',
        'usage_timestamp',
        'created_at',
        'updated_at',
        'billed_at',
        'usage_type',
        'unit_amount_in_cents',
        'usage_percentage'
      ],
      idField: 'id',
      singular: 'usage',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'usage'
  }

  create(options, callback) {
    if (!this.subscription_uuid) {
      throw (new Error('usage must include "subscription_uuid" parameter'))
    }
    if (!this.add_on_code) {
      throw (new Error('usage must include "add_on_code" information'))
    }

    const body = data2xml(AddonUsage.SINGULAR, options)
    const url = `${RecurlyData.ENDPOINT}subscriptions/${this.subscription_uuid}/add_ons/${this.add_on_code}/${AddonUsage.SINGULAR}`

    this.post(url, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        return callback(error)
      }

      this.inflate(payload)
      callback(null, this)
    })
  }

  getUnitAmount() {
    let amount = this.unit_amount_in_cents || null
    if (!amount) {
      const percentage = this.getPercentage()
      if (percentage) {
        amount = Math.round(this.amount * percentage / 100)
      }
    }
    return amount
  }

  getPercentage() {
    if (typeof this.usage_percentage === 'object') {
      return parseFloat(this.usage_percentage['#']) || null
    }
    return null
  }
}

module.exports = AddonUsage
