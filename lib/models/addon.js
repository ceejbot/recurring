'use strict'

const RecurlyData = require('../recurly-data')
const handleRecurlyError = require('../util').handleRecurlyError
const data2xml = require('data2xml')({
  undefined: 'empty',
  null: 'closed'
})
const log = require('../logger')

class Addon extends RecurlyData {
  constructor(recurring) {
    super({
      recurring,
      properties: [
        'add_on_code',
        'created_at',
        'default_quantity',
        'display_quantity_on_hosted_page',
        'href',
        'name',
        'unit_amount_in_cents',
        'updated_at'
      ],
      idField: 'add_on_code',
      plural: 'add_ons',
      singular: 'add_on'
    })
  }

  static get SINGULAR() {
    return 'add_on'
  }

  static get PLURAL() {
    return 'add_ons'
  }

  static get ENDPOINT() {
    return `${RecurlyData.ENDPOINT}${Addon.PLURAL}`
  }

  create(options, callback) {
    if (!this.plan_code) {
      throw (new Error('addon must include "plan_code" parameter'))
    }

    const body = data2xml(Addon.SINGULAR, options)
    const url = `${RecurlyData.ENDPOINT}plans/${this.plan_code}/${Addon.PLURAL}`
    const debugData = {
      body,
      url,
      options
    }
    log.info(`[Addon/create] Start`, { debugData })

    this.post(url, body, (err, response, payload) => {
      const error = handleRecurlyError(err, response, payload, [ 200, 201 ])
      if (error) {
        log.error('[Addon/create] Error', {
          err,
          error,
          debugData,
          payload
        })

        return callback(error)
      }

      this.inflate(payload)
      log.info('[Addon/create] End', { debugData, payload })
      callback(null, this)
    })
  }
}

module.exports = Addon
