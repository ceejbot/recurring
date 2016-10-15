'use strict'

const demand = require('must')
const Recurring = require('../lib/recurly')
const iterators = require('async-iterators')

const recurly = new Recurring()

// This recurly account is an empty test account connected to their
// development gateway.
const config = {
  apikey: '88ac57c6891440bda9ba28b6b9c18857',
  subdomain: 'recurring-test'
}

before(() => {
  recurly.setAPIKey(config.apikey)
})

describe('Iterator', () => {
  it('Can loop through items in an iterator', function(done) {
    this.timeout(30000)
    const iterator = recurly.Transaction().iterator()
    iterator.must.be.an.object()
    iterators.forEachAsync(iterator, (err, transaction, cb) => {
      demand(err).not.exist()
      transaction.must.have.an.id
      cb()
    }, done)
  })
})
