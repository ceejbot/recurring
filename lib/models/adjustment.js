'use strict'

const RecurlyData = require('../recurly-data')

class Adjustment extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'created_at',
        'currency',
        'single_use',
        'state',
        'total_discounted_in_cents',
        'unit_amount_in_cents',
        'quantity',
        'description'
      ],
      idField: '',
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
}

module.exports = Adjustment
