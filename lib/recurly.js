'use strict'

const Promise = require('bluebird')
const Account = require('./models/account')
const Addon = require('./models/addon')
const Adjustment = require('./models/adjustment')
const BillingInfo = require('./models/billing-info')
const Coupon = require('./models/coupon')
const Invoice = require('./models/invoice')
const Plan = require('./models/plan')
const Redemption = require('./models/redemption')
const Subscription = require('./models/subscription')
const Transaction = require('./models/transaction')

const request = require('request')
const debug = require('debug')('recurring')

const Recurring = class Recurring {
  constructor() {
    this.APIKEY = null
    this.AUTH_BASIC = null
    this.request = require('throttled-request')(request)
  }

  setAPIKey(key) {
    this.APIKEY = key
    this.AUTH_BASIC = `Basic ${(new Buffer(this.APIKEY + ':', 'ascii')).toString('base64')}`
    debug('Setting API Key to %s', this.APIKEY)
    debug('Setting Authentication header to %s', this.AUTH_BASIC)
  }

  setRateLimit(to, per) {
    this.request.configure({
      requests: to,
      milliseconds: per
    })
  }

  Account() {
    return Promise.promisifyAll(new Account(this))
  }

  Addon() {
    return Promise.promisifyAll(new Addon(this))
  }

  Adjustment() {
    return Promise.promisifyAll(new Adjustment(this))
  }

  BillingInfo() {
    return Promise.promisifyAll(new BillingInfo(this))
  }

  Coupon() {
    return Promise.promisifyAll(new Coupon(this))
  }

  Invoice() {
    return Promise.promisifyAll(new Invoice(this))
  }

  Plan() {
    return Promise.promisifyAll(new Plan(this))
  }

  Redemption() {
    return Promise.promisifyAll(new Redemption(this))
  }

  Subscription() {
    return Promise.promisifyAll(new Subscription(this))
  }

  Transaction() {
    return Promise.promisifyAll(new Transaction(this))
  }
}

module.exports = Recurring
