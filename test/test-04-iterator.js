'use strict'

const demand = require('must')
const Recurring = require('../lib/recurly')
const iterators = require('async-iterators')

const recurly = new Recurring()
const nock = require('nock')

// This recurly account is an empty test account connected to their
// development gateway.
const config = {
  apikey: '260ba794592e40e38d30f23143b1375b',
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

  it('Returns an error if an error is encountered', function(done) {
    nock('https://api.recurly.com:443', {'encodedQueryParams': true})
      .head('/v2/transactions')
      .reply(200, null, {
        'X-records': 10
      })
      .get('/v2/transactions')
      .query({'per_page': '200'})
      .reply(429, '<?xml version="1.0" encoding="UTF-8"?><error></error>')
    const iterator = recurly.Transaction().iterator()
    iterator.must.be.an.object()
    iterators.forEachAsync(iterator, (err, transaction, cb) => {
      demand(err).not.exist()
      return done(new Error('should not have got this far'))
    }, function(err, res) {
      demand(err).exist()
      done()
    })
  })
})
