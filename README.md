[![Build Status](https://travis-ci.org/ceejbot/recurring.png)](https://travis-ci.org/ceejbot/recurring)

A node client for [recurly](https://recurly.com)'s v2 api, with support for secure parameter signing for [recurly.js](https://docs.recurly.com/recurlyjs) embedded forms.

__This code is still in development and is not ready for production use.__ 

## Recurly API

A work in progress.

Recurly is not consistent about how it names the ID fields for each data type. For some it's `uuid` and for others `foo_code`. Recurring hides this away: every data type has an `id` property that sets the correct field name for Recurly.

```javascript
var recurly = require('recurring');
recurly.setAPIKey('your-api-key');

var account = new recurly.Account();
account.id = 'account-uuid';
account.fetch(function(err)
{
    account.fetchSubscriptions(function(err, subscriptions)
    {
        console.log(subscriptions[0].plan);
        subscriptions[0].cancel(function(err, updated)
        {
        	console.log(updated.state); // will be 'canceled'
        });
    });
});

recurly.Account.all(function(accounts)
{
    // accounts is an array containing all customer accounts
});

recurly.Plan.all(function(plans)
{
    // plans is an array containing all plans set up for your account
});

```

### Errors

Eventually I'll document RecurlyError here.

## SignedQuery

This provides the back-end support for signing parameters for forms embedded using recurly.js. See Recurly's [signature documentation](https://docs.recurly.com/api/recurlyjs/signatures) for details on which parameters must be signed for each form type.

```javascript
var recurly = require('recurring');

var signer = new recurly.SignedQuery('your-private-api-key');
signer.set('account', { account_code: 'account-id' });
var signedParameters = signer.toString();
```

The `nonce` & `timestamp` parameters are generated for you if you don't provide them. The nonce is created using [node-uuid](https://github.com/broofa/node-uuid).

## License

MIT. See accompanying LICENSE file.
