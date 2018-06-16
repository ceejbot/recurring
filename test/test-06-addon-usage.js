'use strict'

const demand = require('must')
const Recurring = require('../lib/recurly')
const recurly = new Recurring()

const nock = require('nock')

describe('Addon Usage', function() {
  it('addon usage creation', function(done) {
    const amount = 1234
    const usageTimestamp = '1970-01-01T12:00:00Z'
    const addonUsage = recurly.AddonUsage()
    addonUsage.add_on_code = 'fx'
    addonUsage.subscription_uuid = 'test12345'

    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<usage href="https://api.recurly.com/v2/subscriptions/${addonUsage.subscription_uuid}/add_ons/${addonUsage.add_on_code}/usage/946867480968562000">
    <measured_unit href="https://api.recurly.com/v2/measured_units/921451269988550641"/>
    <id type="integer">946867480968562000</id>
    <amount type="integer">${amount}</amount>
    <merchant_tag>Purchase at nklnlnlnil</merchant_tag>
    <recording_timestamp type="datetime">2018-05-30T14:12:50Z</recording_timestamp>
    <usage_timestamp type="datetime">${usageTimestamp}</usage_timestamp>
    <created_at type="datetime">2018-05-30T14:16:39Z</created_at>
    <updated_at type="datetime">2018-05-30T14:16:39Z</updated_at>
    <billed_at nil="nil"></billed_at>
    <usage_type>percentage</usage_type>
    <unit_amount_in_cents nil="nil"></unit_amount_in_cents>
    <usage_percentage type="float">1.7</usage_percentage>
</usage>`

    nock('https://api.recurly.com/v2')
      .post(`/subscriptions/${addonUsage.subscription_uuid}/add_ons/${addonUsage.add_on_code}/usage`)
      .reply(200, xmlResponse)

    addonUsage.create({ amount, usage_timestamp: usageTimestamp }, (err, usageRecord) => {
      demand(err).not.exist()
      usageRecord.must.be.an.object()
      usageRecord.id.must.equal(946867480968562080)
      done()
    })
  })
})
