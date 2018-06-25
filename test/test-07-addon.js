'use strict'

const demand = require('must')
const Recurring = require('../lib/recurly')
const recurly = new Recurring()

const nock = require('nock')

describe('Addon', function() {
  it('addon creation', function(done) {
    const addOnCode = 'FX'
    const name = 'Foreign transaction fee'
    const unitAmountInCents = [{ USD: 200 }, { EUR: 180 }]
    const addOn = recurly.Addon()
    addOn.plan_code = 'test_plan'

    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<add_on href="https://api.recurly.com/v2/plans/gold/add_ons/FX">
  <plan href="https://api.recurly.com/v2/plans/test_plan"/>
  <measured_unit href="https://api.recurly.com/v2/measured_units/12345678901234567890"/>
  <add_on_code>FX</add_on_code>
  <name>Foreign transaction fee</name>
  <default_quantity type="integer">1</default_quantity>
  <display_quantity_on_hosted_page type="boolean">false</display_quantity_on_hosted_page>
  <tax_code nil="nil"/>
  <unit_amount_in_cents>
    <USD type="integer">200</USD>
    <EUR type="integer">180</EUR>
  </unit_amount_in_cents>
  <accounting_code nil="nil"/>
  <add_on_type>usage</add_on_type>
  <optional type="boolean">true</optional>
  <usage_type>price</usage_type>
  <usage_percentage nil="nil"/>
  <revenue_schedule_type>evenly</revenue_schedule_type>
  <created_at type="datetime">2016-08-03T15:25:09Z</created_at>
  <updated_at type="datetime">2016-08-03T15:25:09Z</updated_at>
</add_on>`

    nock('https://api.recurly.com/v2')
      .post(`/plans/${addOn.plan_code}/add_ons`)
      .reply(200, xmlResponse)

    addOn.create({ add_on_code: addOnCode, name, unit_amount_in_cents: unitAmountInCents }, (err, addOn) => {
      demand(err).not.exist()
      addOn.must.be.an.object()
      addOn.add_on_code.must.equal('FX')
      done()
    })
  })
})
