A node client for [recurly](https://recurly.com)'s v2 api, with support for secure parameter signing for [recurly.js](https://docs.recurly.com/recurlyjs) embedded forms.

[![on npm](http://img.shields.io/npm/v/recurring.svg?style=flat)](https://www.npmjs.org/package/recurring)  [![Tests](http://img.shields.io/travis/ceejbot/recurring.svg?style=flat)](http://travis-ci.org/ceejbot/recurring)  [![Dependencies](http://img.shields.io/david/ceejbot/recurring.svg?style=flat)](https://david-dm.org/ceejbot/recurring)


__This code is still in development.__ I don't have complete coverage of the API yet.

## Recurly API

An example of typical usage:

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

### All data types

Recurly is not consistent about how it names the ID fields for each data type. For some it's `uuid` and for others `foo_code`. Recurring hides this away: every data type has an `id` property that sets the correct field name for Recurly.


*DataType.create(optionsHash, function(err, object))*

Create an object of the given type by POSTing to Recurly.

*instance.fetch(function(err))*

Fetch an item of a given type from Recurly. The item must have an id.

*instance.destroy(function(err))*

Destroy, delete, close, cancel, or otherwise remove the specified object. Invokes http `DELETE` on the item's href. The item must have an id.

*instance.update(options, function(err))*

Most data types have an `update()` method that changes the stored data.

### Plan

Plan.all()  
plan.fetchAddOns(callback)

### Account

*Account.all(state, function(err, accounts))*

Responds with an array of all accounts in the passed-in state. Defaults to 'active'.


*account.update(data, function(err))*  

Modifies the account data with the passed-in hash.

*account.close()*  

Alias for delete.

*account.reopen()*

Reopens a closed account.

*account.fetchBillingInfo(function(err, info))*  

Responds with a BillingInfo object for this account.

*account.fetchSubscriptions(function(err, subscriptions)*

Responds with an array of subscriptions for this account.

### Billing Info

update()

### Subscription

subscription.update(options, callback)  
subscription.reactivate(callback)  
subscription.cancel(callback)  
subscription.postpone(nextRenewalDate, callback)  
subscription.terminate(refundType, callback)

### Coupon

coupon.redeem(options, function(err, redemption))

### Redemption



### Transaction

*Transaction.create(options, function(err, transaction))*  

Post a transaction with the given options. Fields in the hash are named exactly as in the recurly documentation. Responds with the newly-created transaction.

*transaction.refund(amountInCents, function(err))*  

If amountInCents is omitted, the transaction is refunded in full. Responds with any errors; the transaction object is updated.

### Errors

All callbacks follow the node convention of reporting any error in the first parameter. If a transaction with Recurly succeeds but is rejected by Recurly for some reason-- inconsistent data, perhaps, or some other reason-- that err parameter is an instance of RecurlyError. The original [transaction errors](http://docs.recurly.com/api/transactions/error-codes) reported by Recurly are available as an array of structs in the `errors` parameter. For instance, here's the result of a billing info update with an invalid, expired CC:

```javascript
{
	name: 'RecurlyError',
	message: '2 transaction errors',
	errors: [
		{
			field: 'billing_info.number',
			symbol: 'invalid',
			message: 'is not a valid credit card number'
		},
		{
			field: 'billing_info.number',
			symbol: 'expired',
			message: 'is expired or has an invalid expiration date'
		}
	]
}

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

## FormResponseToken

After Recurly handles a form submission, it posts to you a token pointing to the form
results. Use a FormResponseToken object to fetch the results object represented by the token.

```javascript
var recurly = require('recurring');

var recurlyResponse = new recurly.FormResponseToken(token, 'subscription');
recurlyResponse.process(function(err, subscription)
{
	if (err)
		return handleError(err);

	// subscription contains the new subscription data;
});
```

Having to hint about the type of the response is clunky; TODO fix.

## Contributing

Unit tests for whatever you fix/implement/improve would be awesome. Recurring's are written with [mocha](http://visionmedia.github.com/mocha/) and [chai](http://chaijs.com).

## License

MIT. See accompanying LICENSE file.
