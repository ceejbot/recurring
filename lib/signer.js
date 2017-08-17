'use strict'

const crypto = require('crypto')
const qs = require('qs')
const uuid = require('uuid')

class SignedQuery {
  constructor(key) {
    this.params = { }
    this.key = key
  }

  serialize() {
    if (!this.qs) {
      if (!this.params.nonce) {
        this.params.nonce = uuid.v4()
      }
      if (!this.params.timestamp) {
        this.params.timestamp = Math.ceil(Date.now() / 1000)
      }

      // alphabetize keys
      const tmp = { }
      const keys = Object.keys(this.params).sort()
      for (let i = 0; i < keys.length; i++) {
        tmp[keys[i]] = this.params[keys[i]]
      }
      this.params = tmp

      this.qs = decodeURI(qs.stringify(this.params))
    }

    return this.qs
  }

  set(key, value) {
    this.qs = null

    if ((typeof key === 'object') && !value) {
      this.params = key
    }
    else {
      this.params[key] = value
    }
  }

  HMAC(data) {
    const hmac = crypto.createHmac('sha1', this.key)
    hmac.update(data)
    return hmac.digest('hex')
  }

  toString() {
    const query = encodeURI(this.serialize())
    return `${this.HMAC(query)}|${query}`
  }
}

exports.SignedQuery = SignedQuery
