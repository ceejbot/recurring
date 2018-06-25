const path = require('path')
var sepia = require('sepia')

sepia.fixtureDir(
  path.join(process.cwd(), 'test', 'fixtures', 'sepia')
)
sepia.filter({
  bodyFilter: body => {
    return body
      // replace uuids
      .replace(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/g, '')
  },
  urlFilter: url => {
    return url
      // replace date strings
      .replace(/\d{4}-\d{2}-.*Z/g, 'datetime')
  }
})
sepia.configure({
  includeHeaderNames: false,
  includeCookieNames: false
})
