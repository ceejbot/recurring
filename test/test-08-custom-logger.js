'use strict'

const demand = require('must')
const sinon = require('sinon')
const Recurring = require('../lib/recurly')
const recurly = new Recurring()

const nock = require('nock')

describe('Custom logger', function() {
  let customLogger

  it('should call custom logger', function(done) {
    customLogger = {
      info: sinon.spy()
    }
    recurly.setCustomLogger(customLogger)

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
      customLogger.info.callCount.must.equal(3)
      customLogger.info.getCall(0).args[0].must.equal('Custom logger was set')
      customLogger.info.getCall(1).args.must.eql([
        '[AddonUsage/create] Start', {
          debugData: {
            body: '<?xml version="1.0" encoding="utf-8"?>\n<usage><amount>1234</amount><usage_timestamp>1970-01-01T12:00:00Z</usage_timestamp></usage>',
            url: 'https://api.recurly.com/v2/subscriptions/test12345/add_ons/fx/usage',
            add_on_code: 'fx',
            subscription_uuid: 'test12345'
          }
        }])

      customLogger.info.getCall(2).args[0].must.eql('[AddonUsage/create] End')
      done()
    })
  })
})
