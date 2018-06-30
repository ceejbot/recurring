'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})
const log = require('../logger')

class Adjustment extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'accounting_code',
        'created_at',
        'currency',
        'description',
        'discount_in_cents',
        'end_date',
        'origin',
        'original_adjustment_uuid',
        'single_use',
        'start_date',
        'state',
        'product_code',
        'tax_in_cents',
        'tax_code',
        'tax_details',
        'tax_exempt',
        'tax_rate',
        'tax_region',
        'tax_type',
        'taxable',
        'total_in_cents',
        'type',
        'unit_amount_in_cents',
        'quantity'
      ],
      idField: 'uuid',
      plural: 'adjustments',
      singular: 'adjustment',
      enumerable: true
    })
  }

  static get SINGULAR() {
    return 'adjustment'
  }

  static get PLURAL() {
    return 'adjustments'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Adjustment.PLURAL}`
  }

  create(options, callback) {
    if (!options.unit_amount_in_cents) {
      throw (new Error('adjustment must include "unit_amount_in_cents" parameter'))
    }
    if (!options.account_code) {
      throw (new Error('adjustment must include "account_code" information'))
    }
    if (!options.currency) {
      throw (new Error('adjustment must include "currency" parameter'))
    }

    const url = `${RecurlyData.ENDPOINT}accounts/${options.account_code}/${Adjustment.PLURAL}`
    delete options.account_code
    const body = data2xml(Adjustment.SINGULAR, options)
    const debugData = {
      body,
      url
    }
    log.info(`[Adjustment/create] Start`, {debugData})

    this.post(url, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        log.error(`[Adjustment/create] Error`, {
          err,
          error,
          debugData,
          payload
        })
        return callback(error)
      }

      this.inflate(payload)
      log.info(`[Adjustment/create] End`, { debugData, payload })
      callback(null, this)
    })
  }
}

module.exports = Adjustment
