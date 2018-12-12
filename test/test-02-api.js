'use strict'

const demand = require('must')
const Recurring = require('../lib/recurly')
const uuid = require('uuid')
const debug = require('debug')('recurring:test')
const _ = require('lodash')

// This recurly account is an empty test account connected to their
// development gateway.
const config = {
  apikey: '88ac57c6891440bda9ba28b6b9c18857',
  plan_code: 'recurring-test',
  subdomain: 'recurring-test'
}

const recurly = new Recurring()
let plan
let account
let subscription
let freshAccountId

before(() => {
  recurly.setAPIKey(config.apikey)
})

describe('Plan', () => {
  let cached

  // create a plan.
  it('can create a plan', done => {
    const planId = uuid.v4()
    const data = {
      plan_code: `testplan${planId}`,
      name: `Test Plan ${planId}`,
      unit_amount_in_cents: {
        USD: 1000
      }
    }

    recurly.Plan().create(data, (err, newPlan) => {
      demand(err).not.exist()
      newPlan.must.be.an.object()
      newPlan.id.must.equal(data.plan_code)
      newPlan.name.must.equal(data.name)
      done()
    })
  })

  it('cannot create a plan without a plan code', done => {
    const planId = uuid.v4()
    const wrong = () => {
      const inadequate = {
        name: `Test Plan ${planId}`,
        unit_amount_in_cents: {
          USD: 1000
        }
      }
      recurly.Plan().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
    done()
  })

  it('cannot create a plan without a plan name', done => {
    const planId = uuid.v4()
    const wrong = () => {
      const inadequate = {
        plan_code: `testplan${planId}`,
        unit_amount_in_cents: {
          USD: 1000
        }
      }
      recurly.Plan().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
    done()
  })

  it('cannot create a plan without a plan unit amount in cents', done => {
    const planId = uuid.v4()
    const wrong = () => {
      const inadequate = {
        plan_code: `testplan${planId}`,
        name: `Test Plan ${planId}`
      }
      recurly.Plan().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
    done()
  })

  it('can fetch all plans from the test Recurly account', done => {
    recurly.Plan().all((err, plans) => {
      demand(err).not.exist()
      plans.must.be.an.object()
      const planCodes = Object.keys(plans)
      planCodes.length.must.be.above(0)
      planCodes[0].must.not.equal('undefined')
      cached = planCodes
      done()
    })
  })

  it('can fetch a single plan', done => {
    plan = recurly.Plan()
    plan.id = cached[0]
    plan.fetch(err => {
      demand(err).not.exist()
      plan.href.length.must.be.above(0)
      plan.must.have.property('name')
      plan.must.have.property('description')
      plan.name.must.exist()
      plan.description.must.exist()
      done()
    })
  })
})

describe('Account', () => {
  it('can create an account', done => {
    freshAccountId = uuid.v4()
    const data = {
      id: freshAccountId,
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Whorfin',
      company_name: 'Yoyodyne Propulsion Systems'
    }
    recurly.Account().create(data, (err, newAccount) => {
      demand(err).not.exist()
      newAccount.must.be.an.object()
      newAccount.id.must.equal(freshAccountId)
      newAccount.company_name.must.equal('Yoyodyne Propulsion Systems')
      done()
    })
  })

  it('can close an account', done => {
    account = recurly.Account()
    account.id = freshAccountId
    account.close((err, closed) => {
      demand(err).not.exist()
      closed.must.equal(true)
      done()
    })
  })

  it('can create or reopen a previously-closed account, transparently', done => {
    const data = { id: freshAccountId }
    recurly.Account().create(data, (err, newAccount) => {
      demand(err).not.exist()
      newAccount.must.be.an.object()
      newAccount.first_name.must.equal('John') // from old data
      newAccount.last_name.must.equal('Whorfin') // from old data
      done()
    })
  })

  it('can fetch a single account', done => {
    account = recurly.Account()
    account.id = freshAccountId
    account.fetch(err => {
      demand(err).not.exist()
      account.must.be.an.object()
      account.email.must.equal('test@example.com')
      account.company_name.must.equal('Yoyodyne Propulsion Systems')
      done()
    })
  })

  it('can fetch all accounts from the test Recurly account', done => {
    recurly.Account().all((err, accounts) => {
      demand(err).not.exist()
      accounts.must.be.an.object()
      const uuids = Object.keys(accounts)
      uuids.length.must.be.above(0)
      uuids[0].must.not.equal('undefined')
      done()
    })
  })

  it('can update an account', done => {
    account.company_name = 'Yoyodyne Propulsion, International'
    account.update((err, updated) => {
      demand(err).not.exist()
      updated.must.be.an.object()

      const testAcc = recurly.Account()
      testAcc.id = account.id
      testAcc.fetch(err => {
        demand(err).not.exist()
        testAcc.company_name.must.equal(account.company_name)
        done()
      })
    })
  })
})

describe('BillingInfo', () => {
  let binfo

  // before(done => {
  //   freshAccountId = uuid.v4()
  //   const data = {
  //     id: freshAccountId,
  //     email: 'test@example.com',
  //     first_name: 'John',
  //     last_name: 'Whorfin',
  //     company_name: 'Yoyodyne Propulsion Systems'
  //   }
  //   recurly.Account().create(data, (err, newAccount) => {
  //     demand(err).not.exist()
  //     account = newAccount
  //     done()
  //   })
  // })

  it('can not retrieve billing info for an account that does not exist', done => {
    const data = {
      id: uuid.v4(),
      email: 'test2@example.com',
      first_name: 'John',
      last_name: 'Smallberries',
      company_name: 'Yoyodyne Propulsion Systems'
    }

    recurly.Account().create(data, (err, newAccount) => {
      demand(err).not.exist()
      newAccount.fetchBillingInfo((err, info) => {
        debug('Got error: %o', err)
        err.must.exist()
        err.error_code.must.equal('not_found')
        demand(info).not.exist()
        done()
      })
    })
  })

  it('can add billing info to an account and skip card authorization', done => {
    binfo = recurly.BillingInfo()
    binfo.account_code = freshAccountId
    binfo.skipAuthorization = true
    const billingData = {
      first_name: account.first_name,
      last_name: account.last_name,
      number: '4000-0000-0000-0077',
      month: 1,
      year: new Date().getFullYear() + 3,
      verification_value: '111',
      address1: '760 Market Street',
      address2: 'Suite 500',
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
      zip: '94102'
    }

    binfo.update(billingData, err => {
      demand(err).not.exist()
      binfo.last_four.must.equal('0077')
      done()
    })
  })

  it('can add billing info to an account', done => {
    binfo = recurly.BillingInfo()
    binfo.account_code = freshAccountId
    const billingData = {
      first_name: account.first_name,
      last_name: account.last_name,
      number: '4111-1111-1111-1111',
      month: 1,
      year: new Date().getFullYear() + 3,
      verification_value: '111',
      address1: '760 Market Street',
      address2: 'Suite 500',
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
      zip: '94102'
    }

    binfo.update(billingData, err => {
      demand(err).not.exist()
      binfo.last_four.must.equal('1111')
      done()
    })
  })

  it('throws an error when missing a required billing data field', done => {
    const binfo2 = recurly.BillingInfo()
    binfo2.account_code = freshAccountId

    const wrong = () => {
      const inadequate = {
        first_name: account.first_name,
        last_name: account.last_name
      }
      binfo2.update(inadequate, _.noop)
    }
    wrong.must.throw(Error)
    done()
  })

  it('can fetch the billing info for an account', done => {
    account.fetchBillingInfo((err, info) => {
      demand(err).not.exist()
      info.first_name.must.equal(account.first_name)
      info.last_four.must.equal('1111')
      info.address2.must.be.a.string()
      done()
    })
  })
})

describe('Subscription', () => {
  // let account
  let cached

  // before(done => {
  //   freshAccountId = uuid.v4()
  //   const data = {
  //     id: freshAccountId,
  //     email: 'test@example.com',
  //     first_name: 'John',
  //     last_name: 'Whorfin',
  //     company_name: 'Yoyodyne Propulsion Systems'
  //   }
  //   recurly.Account().create(data, (err, newAccount) => {
  //     demand(err).not.exist()
  //     account = newAccount
  //
  //     const binfo = recurly.BillingInfo()
  //     binfo.account_code = freshAccountId
  //     const billingData = {
  //       first_name: account.first_name,
  //       last_name: account.last_name,
  //       number: '4111-1111-1111-1111',
  //       month: 1,
  //       year: (new Date()).getFullYear() + 3,
  //       verification_value: '111',
  //       address1: '760 Market Street',
  //       address2: 'Suite 500',
  //       city: 'San Francisco',
  //       state: 'CA',
  //       country: 'US',
  //       zip: '94102'
  //     }
  //
  //     binfo.update(billingData, err => {
  //       demand(err).not.exist()
  //       binfo.last_four.must.equal('1111')
  //       done()
  //     })
  //   })
  // })

  it('can create a subscription for an account', done => {
    const data = {
      plan_code: config.plan_code,
      account: {
        account_code: account.id
      },
      currency: 'USD',
      quantity: 10
    }

    recurly.Subscription().create(data, (err, newsub) => {
      demand(err).not.exist()
      newsub.id.must.exist()
      newsub.quantity.must.equal(10)
      newsub.plan.must.be.an.object()
      newsub.plan.plan_code.must.equal(config.plan_code)

      subscription = newsub
      done()
    })
  })

  it('can fetch all subscriptions associated with an account', done => {
    account.fetchSubscriptions((err, subscriptions) => {
      demand(err).not.exist()
      subscriptions.must.be.an.array()
      cached = subscriptions
      done()
    })
  })

  it('can fetch a single subscription', done => {
    const uuid = cached[0].uuid
    subscription = recurly.Subscription()
    subscription.id = uuid
    subscription.fetch(err => {
      demand(err).not.exist()
      subscription.must.have.property('_resources')
      subscription._resources.must.be.an.object()
      subscription._resources.must.have.property('account')
      subscription.account_id.must.equal(account.id)

      done()
    })
  })

  it('throws an error when attempting to modify a subscription without a timeframe', done => {
    const wrong = () => {
      subscription.update({ inadequate: true }, _.noop)
    }
    wrong.must.throw(Error)
    done()
  })

  it('can modify a subscription', done => {
    const mods = {
      timeframe: 'now',
      quantity: subscription.quantity + 3
    }

    subscription.update(mods, err => {
      demand(err).not.exist()
      subscription.must.be.an.object()
      subscription.quantity.must.equal(mods.quantity)

      done()
    })
  })

  it('can cancel a subscription', done => {
    subscription.cancel(err => {
      demand(err).not.exist()
      subscription.state.must.equal('canceled')
      subscription.canceled_at.must.be.a.date()
      subscription.expires_at.must.be.a.date() // in the future, even

      done()
    })
  })

  it('can reactivate a subscription', done => {
    subscription.reactivate(err => {
      demand(err).not.exist()
      subscription.state.must.equal('active')
      subscription.activated_at.must.be.a.date()
      subscription.activated_at
        .getTime()
        .must.equal(subscription.current_period_started_at.getTime())
      subscription.canceled_at.must.be.a.string()
      subscription.expires_at.must.be.a.string()

      done()
    })
  })

  it('can postpone a subscription', done => {
    const now = new Date()
    const nextDate = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)

    subscription.postpone(nextDate, err => {
      demand(err).not.exist()
      nextDate
        .getTime()
        .must.equal(subscription.current_period_ends_at.getTime())
      done()
    })
  })

  it('can terminate a subscription without a refund', done => {
    subscription.terminate('none', err => {
      demand(err).not.exist()
      subscription.state.must.equal('expired')
      subscription.canceled_at.must.be.a.date()
      done()
    })
  })
})

describe.skip('Coupons', () => {
  let coupon, couponCode

  it('can create a coupon', done => {
    couponCode = uuid.v4()
    const data = {
      coupon_code: couponCode,
      name: 'Test Coupon',
      discount_type: 'percent',
      discount_percent: 50,
      single_use: true,
      invoice_description: 'The coupon, as invoiced',
      hosted_description: 'This is a description of a coupon'
    }

    recurly.Coupon().create(data, (err, coup) => {
      demand(err).not.exist()
      coup.coupon_code.must.equal(couponCode)
      coup.state.must.equal('redeemable')
      coup.single_use.must.equal(true)
      coup.applies_to_all_plans.must.equal(true)
      done()
    })
  })

  it('can fetch a coupon', done => {
    coupon = recurly.Coupon()
    coupon.id = couponCode
    coupon.fetch(err => {
      demand(err).not.exist()
      coupon.coupon_code.must.equal(couponCode)
      coupon.state.must.equal('redeemable')
      coupon.single_use.must.equal(true)
      coupon.applies_to_all_plans.must.equal(true)
      coupon.name.must.equal('Test Coupon')
      done()
    })
  })

  it('can redeem a coupon', done => {
    const options = { account_code: freshAccountId, currency: 'USD' }

    coupon.redeem(options, (err, redemption) => {
      demand(err).not.exist()
      redemption.coupon_code.must.equal(couponCode)
      redemption.single_use.must.equal(true)
      done()
    })
  })

  // examine a redemption object

  it('can delete a coupon', done => {
    coupon.destroy(err => {
      console.log(err)
      demand(err).not.exist()
      done()
    })
  })
})

describe('Transactions', () => {
  let trans1

  it('can fetch all transactions from the test Recurly account', done => {
    recurly.Transaction().all((err, transactions) => {
      demand(err).not.exist()
      transactions.must.be.an.object()
      const transactionsIds = Object.keys(transactions)
      transactionsIds.length.must.be.above(0)
      transactionsIds[0].must.not.equal('undefined')
      done()
    })
  })

  it('requires an account parameter with account code', () => {
    const wrong = () => {
      const inadequate = { amount_in_cents: 10, currency: 'USD' }
      recurly.Transaction().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
  })

  it('requires an amount_in_cents parameter when creating a transaction', () => {
    const wrong = () => {
      const inadequate = {
        account: {
          account_code: freshAccountId
        },
        currency: 'USD'
      }
      recurly.Transaction().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
  })

  it('requires an currency parameter when creating a transaction', () => {
    const wrong = () => {
      const inadequate = {
        account: {
          account_code: freshAccountId
        },
        amount_in_cents: 10
      }
      recurly.Transaction().create(inadequate, _.noop)
    }
    wrong.must.throw(Error)
  })

  it('can create a transaction', done => {
    const options = {
      amount_in_cents: 100,
      currency: 'USD',
      account: {
        account_code: freshAccountId
      }
    }

    recurly.Transaction().create(options, (err, transaction) => {
      demand(err).not.exist()
      transaction.action.must.equal('purchase')
      transaction.amount_in_cents.must.equal(100)
      transaction.currency.must.equal('USD')
      transaction.status.must.equal('success')
      transaction.reference.must.exist()
      transaction.voidable.must.equal(true)
      transaction.refundable.must.equal(true)

      transaction.details.must.have.property('account')
      transaction.details.account.account_code.must.equal(freshAccountId)

      trans1 = transaction
      done()
    })
  })

  it.skip('can refund a transaction fully', done => {
    trans1.refund(err => {
      demand(err).not.exist()
      trans1.status.must.equal('void')
      trans1.voidable.must.equal(false)
      trans1.refundable.must.equal(false)
      done()
    })
  })

  it.skip('can refund a transaction partially', done => {
    const options = {
      amount_in_cents: 500,
      currency: 'USD',
      account: {
        account_code: freshAccountId
      }
    }

    recurly.Transaction().create(options, (err, transaction) => {
      demand(err).not.exist()
      transaction.refund(250, err => {
        demand(err).not.exist()
        transaction.amount_in_cents.must.equal(250)
        transaction.status.must.equal('success')
        transaction.voidable.must.equal(true)
        transaction.refundable.must.equal(false)
        done()
      })
    })
  })
})

describe('Invoices', () => {
  it('can fetch all invoices from the test Recurly account', done => {
    recurly.Invoice().all((err, invoices) => {
      demand(err).not.exist()
      invoices.must.be.an.object()
      const invoiceIds = Object.keys(invoices)
      invoiceIds.length.must.be.above(0)
      invoiceIds[0].must.not.equal('undefined')
      done()
    })
  })

  describe('refunds', () => {
    before(function(done) {
      recurly.Invoice().all({ state: 'paid' }, (err, invoices) => {
        demand(err).not.exist()
        this.invoices = invoices
        done()
      })
    })

    it('requires an invoice_number when refunding an invoice', function() {
      const wrong = () => {
        const invoice = recurly.Invoice()
        invoice.id = this.invoices[0].uuid
        invoice.refund(_.noop)
      }
      wrong.must.throw(Error)
    })

    it('can issue an open amount refund for a specific amount against an invoice', function(done) {
      const refundableInvoice = _.find(this.invoices, invoice =>
        _.get(invoice, 'a.refund')
      )
      debug('invoice to refund', refundableInvoice)
      const refundOptions = { amount_in_cents: 5 }

      const invoice = recurly.Invoice()
      invoice.id = refundableInvoice.id
      invoice.invoice_number = refundableInvoice.invoice_number
      invoice.refund(refundOptions, err => {
        demand(err).not.exist()
        debug('new refund invoice', invoice)
        invoice.must.have.property('_resources')
        invoice._resources.must.be.an.object()
        invoice._resources.must.have.property('account')
        invoice._resources.must.have.property('original_invoice')
        invoice.must.have.property('properties')
        invoice.must.be.an.object()
        invoice.must.have.property('invoice_number')
        invoice.invoice_number.must.not.equal(refundableInvoice.invoice_number)
        invoice.subtotal_in_cents.must.be.below(0)
        invoice.subtotal_in_cents.must.equal(refundOptions.amount_in_cents * -1)
        done()
      })
    })

    it('can issue an open amount refund for the full amount against an invoice', function(done) {
      const refundableInvoice = _.findLast(this.invoices, invoice =>
        _.get(invoice, 'a.refund')
      )
      debug('invoice to refund', refundableInvoice)

      const invoice = recurly.Invoice()
      invoice.id = refundableInvoice.id
      invoice.invoice_number = refundableInvoice.invoice_number
      invoice.refund(err => {
        demand(err).not.exist()
        debug('new refund invoice', invoice)
        invoice.must.have.property('_resources')
        invoice._resources.must.be.an.object()
        invoice._resources.must.have.property('account')
        invoice._resources.must.have.property('original_invoice')
        invoice.must.have.property('properties')
        invoice.must.be.an.object()
        invoice.must.have.property('invoice_number')
        invoice.invoice_number.must.not.equal(refundableInvoice.invoice_number)
        invoice.total_in_cents.must.be.below(0)
        invoice.total_in_cents.must.equal(refundableInvoice.total_in_cents * -1)
        done()
      })
    })
  })

  describe('cancelations', () => {
    before(function(done) {
      const accountData = {
        id: uuid.v4()
      }

      // Create a test account
      recurly.Account().create(accountData, (err, account) => {
        if (err) return done(err)

        const adjustmentData = {
          currency: 'USD',
          unit_amount_in_cents: 2000,
          quantity: 1,
          description: 'A test charge for $20'
        }

        // add a charge to that account
        account.createAdjustment(adjustmentData, (err, adjustment) => {
          if (err) return done(err)

          // create an invoice with the pending charges
          account.createInvoice((err, invoice) => {
            if (err) return done(err)
            this.invoiceToMarkAsFailed = invoice
            done()
          })
        })
      })
    })

    it('can mark an open invoice as failed collection', function(done) {
      const invoice = recurly.Invoice()
      invoice.invoice_number = this.invoiceToMarkAsFailed.invoice_number

      invoice.markFailed(err => {
        demand(err).not.exist()
        invoice.state.must.equal('failed')
        done()
      })
    })
  })
})

describe('RecurlyError', () => {
  describe('General errors', () => {
    it('handles a general error', done => {
      const account = recurly.Account()
      account.id = 'some-invalid-id'
      account.fetch(err => {
        debug('Got error: %o', err)
        demand(err).to.exist()
        err.must.be.an.object()
        err.must.have.property('message')
        demand(err.message).to.not.be.undefined()
        err.must.have.property('errors')
        err.errors.must.be.an.array()
        err.errors.length.must.equal(1)
        err.errors[0].symbol.must.equal('not_found')
        done()
      })
    })

    it('handles a single field validation error', done => {
      const data = {
        id: uuid.v4(),
        email: 'test@example.com2', // Note invalid email address
        first_name: 'John',
        last_name: 'Whorfin',
        company_name: 'Yoyodyne Propulsion Systems'
      }

      recurly.Account().create(data, (err, newAccount) => {
        debug('Got error: %o', err)
        demand(err).to.exist()
        err.must.be.an.object()
        err.must.have.property('message')
        demand(err.message).to.not.be.undefined()
        err.must.have.property('errors')
        err.errors.must.be.an.array()
        err.errors.length.must.equal(1)
        err.errors[0].field.must.equal('account.email')
        err.errors[0].symbol.must.equal('invalid_email')
        done()
      })
    })
  })

  describe('Transaction errors', () => {
    beforeEach(function(done) {
      const self = this
      const data = {
        id: uuid.v4(),
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Whorfin',
        company_name: 'Yoyodyne Propulsion Systems'
      }
      recurly.Account().create(data, (err, newAccount) => {
        demand(err).not.exist()
        self.account = newAccount
        done()
      })
    })

    it('handles multiple validation errors', function(done) {
      account = recurly.Account()
      account.id = this.account.id

      const binfo = recurly.BillingInfo()
      binfo.account_code = this.account.id
      const billingData = {
        first_name: this.account.properties.first_name,
        last_name: this.account.properties.last_name,
        number: '4111-1111', // Note invalid format
        month: 1,
        year: 2010,
        verification_value: '111'
      }

      binfo.update(billingData, err => {
        debug('Got error: %o', err)
        demand(err).to.exist()
        err.must.be.an.object()
        err.must.have.property('message')
        err.message.must.not.equal('undefined')
        err.must.have.property('errors')
        err.errors.must.be.an.array()
        err.errors.length.must.equal(6)
        done()
      })
    })

    it('handles multiple transaction errors', function(done) {
      account = recurly.Account()
      account.id = this.account.id

      const binfo = recurly.BillingInfo()
      binfo.account_code = this.account.id
      const billingData = {
        first_name: this.account.properties.first_name,
        last_name: this.account.properties.last_name,
        number: '4000-0000-0000-0101',
        month: 1,
        year: new Date().getFullYear() + 3,
        verification_value: '111',
        address1: '760 Market Street',
        address2: 'Suite 500',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        zip: '94102'
      }

      binfo.update(billingData, err => {
        debug('Got error: %o', err)
        demand(err).to.exist()
        err.must.be.an.object()
        err.must.have.property('message')
        err.message.must.not.equal('undefined')
        err.must.have.property('errors')
        err.must.have.property('error_code')
        err.must.have.property('error_category')
        err.must.have.property('merchant_message')
        err.must.have.property('customer_message')
        err.errors.must.be.an.array()
        err.errors.length.must.equal(1)
        err.error_code.must.equal('fraud_security_code')
        done()
      })
    })
  })
})

describe('Initialization', () => {
  it('should create a new Recurring instance', () => {
    const recurly1 = new Recurring()
    demand(recurly1.APIKEY).not.exist()
    recurly1.setAPIKey('123')
    recurly1.APIKEY.must.equal('123')

    const recurly2 = new Recurring()
    demand(recurly2.APIKEY).not.exist()
    recurly2.setAPIKey('abc')
    recurly2.APIKEY.must.equal('abc')

    recurly1.APIKEY.must.equal('123')
    recurly2.APIKEY.must.equal('abc')
  })
})

describe('Prerequsites', () => {
  before(() => {
    recurly.setAPIKey('')
  })
  it('should raise an error if the API Key has not been set.', done => {
    const data = {
      id: uuid.v4(),
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Whorfin',
      company_name: 'Yoyodyne Propulsion Systems'
    }
    recurly.Account().create(data, (err, newAccount) => {
      demand(err).exist()
      err.must.be.an(Error)
      done()
    })
  })
  after(() => {
    recurly.setAPIKey(config.apikey)
  })
})
