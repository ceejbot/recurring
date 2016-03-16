'use strict'

const Account = require('./account')
const RecurlyData = require('../recurly-data')

class Redemption extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'created_at',
        'currency',
        'single_use',
        'state',
        'total_discounted_in_cents'
      ],
      idField: '',
      plural: 'redemptions',
      singular: 'redemption'
    })

    this.__defineGetter__('account_code', () => {
      return this.account_code
    })

    this.__defineSetter__('account_code', account_code => {
      this.properties.account_code = account_code
      if (!this.href) {
        this.href = `${Account.ENDPOINT}/${account_code}/redemption`
      }
    })
  }

  static get SINGULAR() {
    return 'redemption'
  }

  static get PLURAL() {
    return 'redemptions'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Redemption.PLURAL}`
  }
}

module.exports = Redemption
