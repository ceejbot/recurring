A node client for [recurly](https://recurly.com)'s v2 api, with support for secure parameter signing for [recurly.js](https://docs.recurly.com/recurlyjs) embedded forms.

__This code is still in development and is not ready for production use.__ In particular, the example usage below might radically change.

## Recurly API

A work in progress.

```javascript
var recurly = require('recurring');
recurly.setAPIKey('your-api-key');

var account = new recurly.Account('account-id');
account.fetch(function(err)
{
    account.fetchSubscriptions(function(err, subscriptions)
    {
        console.log(subscriptions[0].plan);
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