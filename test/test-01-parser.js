'use strict'

const demand = require('must')
const fs = require('fs')
const parser = require('../lib/parser')
const path = require('path')

// ----------------------------------------------------------------------

let testdir = __dirname

if (path.basename(testdir) !== 'test') {
  testdir = path.join(testdir, 'test')
}

function readFixture(fixture) {
  const fpath = path.join(testdir, 'fixtures', fixture)
  const data = fs.readFileSync(fpath, 'utf8')
  return data
}

// ----------------------------------------------------------------------

let rparser

before(() => {
  rparser = parser.createParser()
})

describe('recurly xml parser', () => {
  const data = readFixture('types.xml')
  let typesResult

  it('can parse basic data types', done => {
    rparser.parseXML(data, (err, result) => {
      demand(err).not.exist()
      typesResult = result
      done()
    })
  })

  it('can parse subarrays', () => {
    typesResult.must.be.an.array()
    typesResult.length.must.equal(2)
  })

  it('can parse single-item subarrays', done => {
    const blortdata = readFixture('single-item.xml')
    rparser.parseXML(blortdata, (err, result) => {
      demand(err).not.exist()
      result.must.be.an.array()
      result.length.must.equal(1)
      result[0].must.be.an.object()
      result[0].must.have.property('name')
      result[0].name.must.equal('The Only Blort')
      done()
    })
  })

  it('can parse boolean types', () => {
    const item = typesResult[0]
    item.boolean_true.must.be.a.boolean()
    item.boolean_true.must.equal(true)
    item.boolean_false.must.be.a.boolean()
    item.boolean_false.must.equal(false)
  })

  it('can parse integer types', () => {
    const item = typesResult[1]
    item.integer_value.must.be.a.number()
    item.integer_value.must.equal(3)
  })

  it('can parse nil types', () => {
    const item = typesResult[0]
    item.must.have.property('nil_value')
    item.nil_value.must.equal('')
  })

  it('can parse datetype types', () => {
    const item = typesResult[0]
    item.datetime_value.must.be.a.date()
    const comparisonDate = new Date('Tue Apr 19 2011 00:00:00 GMT-0700 (PDT)')
    item.datetime_value.getTime().must.equal(comparisonDate.getTime())
  })

  it('can parse subobjects', () => {
    const item = typesResult[1]
    item.hash_value.must.be.an.object()
    item.hash_value.must.have.property('one')
    item.hash_value.must.have.property('two')
    item.hash_value.one.must.equal(1000)
  })

  it('can parse sample plan xml', done => {
    const data = readFixture('plans.xml')
    rparser.parseXML(data, (err, result) => {
      demand(err).not.exist()
      result.must.be.an.array()
      result.must.be.an.array()
      result.length.must.equal(4)
      done()
    })
  })

  it('can parse sample subscription xml', done => {
    const data = readFixture('subscription.xml')
    rparser.parseXML(data, (err, result) => {
      demand(err).not.exist()
      result.must.be.an.array()
      result.length.must.equal(1)
      const subscription = result[0]
      subscription.must.have.property('uuid')
      subscription.uuid.must.equal('44f83d7cba354d5b84812419f923ea96')
      done()
    })
  })

  it('can parse sample transaction xml', done => {
    const data = readFixture('transactions.xml')
    rparser.parseXML(data, (err, result) => {
      demand(err).not.exist()
      result.must.be.an.array()
      result.length.must.equal(1)
      const transaction = result[0]
      transaction.must.have.property('uuid')
      transaction.uuid.must.equal('a13acd8fe4294916b79aec87b7ea441f')
      done()
    })
  })

  it('can parse sample billing info xml', done => {
    const data = readFixture('billing_info_cc.xml')
    rparser.parseXML(data, (err, result) => {
      demand(err).not.exist()
      result.must.not.be.an.array()
      result.must.have.property('href')
      result.must.have.property('type')
      done()
    })
  })
})
