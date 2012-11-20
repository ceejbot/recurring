/*jshint node:true */

var
	_ = require('lodash'),
	data2xml = require('data2xml'),
	path = require('path'),
	querystring = require('querystring'),
	request = require('request'),
	rparser = require('./parser.js'),
	util = require('util')
	;

//----------------------------------------------------------------------------------------

var
	ENDPOINT = 'https://api.recurly.com/v2/',
	APIKEY, AUTH_BASIC,
	parser = rparser.createParser()
	;

function setAPIKey(key)
{
	APIKEY = key;
	AUTH_BASIC = 'Basic ' + (new Buffer(APIKEY + ':', "ascii")).toString('base64');
}

//----------------------------------------------------------------------------------------

function RecurlyError(struct)
{
	this.name = 'RecurlyError';
	this.message = struct.symbol;
	this.error = struct;
}
util.inherits(RecurlyError, Error);

function handleRecurlyError(err, response, payload, validStatuses)
{
	if (err)
		return err;
	if (!response)
		return new Error('no response object');

	var idx = validStatuses.indexOf(response.statusCode);
	if (idx === -1)
		return new Error('unexpected status: ' + response.statusCode);

	if (!payload || (typeof payload !== 'object'))
		return;

	if (payload.hasOwnProperty('error'))
	{
		return new RecurlyError(payload.error);
	}
}

//----------------------------------------------------------------------------------------

function RecurlyData() { }

RecurlyData.base_options = function ()
{
	return {
		headers:
		{
			'Accept': 'application/xml',
			'Authorization': AUTH_BASIC,
		},
	};
};

function execute(options, callback)
{
	request(options, function(err, response, body)
	{
		if (err)
		{
			console.error('recurly.' + options.method, 'error ' + JSON.stringify(err));
			return callback(err);
		}

		parser.parseXML(body, function(err, result)
		{
			if (err)
			{
				console.error('recurly.get', 'xml parsing error ' + JSON.stringify(err));
				return callback(err, response, {});
			}

			callback(null, response, result);
		});
	});
}

RecurlyData.get = function(uri, queryargs, callback)
{
	var options = RecurlyData.base_options();
	options.uri = uri;
	options.method = 'GET';
	execute(options, callback);
};

RecurlyData.put = function(uri, postargs, callback)
{
	var options = RecurlyData.base_options();
	options.uri = uri;
	options.body = postargs;
	options.method = 'PUT';
	execute(options, callback);
};

RecurlyData.post = function(uri, postargs, callback)
{
	var options = RecurlyData.base_options();
	options.uri = uri;
	options.body = postargs;
	options.method = 'POST';
	execute(options, callback);
};

RecurlyData.destroy = function(uri, callback)
{
	var options = RecurlyData.base_options();
	options.uri = uri;

	request.del(options, function(err, response, body)
	{
		if (body)
		{
			parser.parseXML(body, function(xmlerr, result)
			{
				if (xmlerr)
					return callback(err, response, body);
				return callback(err, response, result);
			});
		}
		else
			callback(err, response);
	});
};

RecurlyData.prototype.destroy = function(callback)
{
	var self = this;

	RecurlyData.destroy(self.href, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [204]);
		if (error)
			return callback(error);

		self.deleted = true;
		callback(null, self.deleted);
	});
};

RecurlyData.prototype.inflate = function(json)
{
	if (typeof json !== 'object')
	{
		console.log(json);
		return;
	}

	var keys = Object.keys(json);
	for (var i = 0; i < keys.length; i++)
	{
		var prop = keys[i];
		if ('a' === prop)
		{
			// Hackery. 'a' is a list of named anchors. We treat them specially.
			this.a = {};
			var anchors = Object.keys(json[prop]);
			for (var j = 0; j < anchors.length; j++)
			{
				var anchor = json[prop][anchors[j]];
				this.a[anchor.name] =  anchor;
			}
		}
		else
			this[prop] = json[prop];
	}
};

RecurlyData.prototype.fetch = function(callback)
{
	var self = this;

	if (!self.href)
		throw(new Error('cannot fetch a record without an href'));

	RecurlyData.get(self.href, {}, function(err, response, payload)
	{
		if (err)
			return callback(err);
		self.inflate(payload);
		callback();
	});
};

RecurlyData.fetchAll = function(Model, uri, callback)
{
	var result = [];
	var done = false;
	var total = -1;

	var finished = function(err)
	{
		callback(err, result);
	};

	var continuer = function(err, headers, records)
	{
		if (err)
			return finished(err);

		// link header in response points to next page of results
		// X-Records header says how many total
		if (total < 0)
			total = parseInt(headers['x-records'], 10);

		_.each(records, function(record)
		{
			var item = new Model();
			item.inflate(record);
			result.push(item);
		});

		if ((result.length >= total) || !headers.link )
			return finished(null);

		uri = headers.link;
		RecurlyData.get(uri, { per_page: 200 }, continuer);
	};

	RecurlyData.get(uri, { per_page: 200 }, continuer);
};

//----------------------------------------------------------------------------------------

RecurlyData.buildPrototype = function(options)
{
	var constructor = function()
	{
		this.properties = {};
	};
	util.inherits(constructor, RecurlyData);

	for (var i = 0; i < options.properties.length; i++)
		RecurlyData.addProperty(constructor, options.properties[i]);
	constructor.prototype.proplist = options.properties;

	constructor.ENDPOINT = ENDPOINT + options.plural;
	constructor.plural = options.plural; // used when generating xml
	constructor.singular = options.singular;

	constructor.prototype.__defineGetter__('id', function() { return this.properties[options.idField]; });
	var idSetter = function()
	{
		var newval = arguments['0'];
		this.properties[options.idField] = newval;
		if (!this.href)
			this.href = constructor.ENDPOINT + '/' + newval;
	};
	constructor.prototype.__defineSetter__('id', idSetter);
	constructor.prototype.__defineSetter__(options.idField, idSetter);

	return constructor;
};

RecurlyData.addProperty = function(constructor, propname)
{
	var getterFunc = function() { return this.properties[propname]; };
	var setterFunc = function()
	{
		var newval = arguments['0'];
		this.properties[propname] = newval;
	};

	constructor.prototype.__defineGetter__(propname, getterFunc);
	constructor.prototype.__defineSetter__(propname, setterFunc);
};

// ----------------------------------------------------------------------

var Account = RecurlyData.buildPrototype(
{
	properties: [
		'accept_language',
		'account_code',
		'created_at',
		'email',
		'first_name',
		'last_name',
		'state',
		'username'
	],
	idField: 'account_code',
	plural: 'accounts',
	singular: 'account'
});

Account.all = function(state, callback)
{
	if (typeof state === 'function')
	{
		callback = state;
		state = 'active';
	}

	if (Account.__all && Account.__all[state])
		return callback(Account.__all[state]);

	if (!Account.__all)
		Account.__all = {};
	if (!Account.__all[state])
		Account.__all[state] = {};

	RecurlyData.fetchAll(Account, Account.ENDPOINT, function(err, results)
	{
		var cache = Account.__all[state];
		_.each(results, function(account)
		{
			cache[account.account_code] = account;
		});
		callback(cache);
	});
};

var Subscription; // forward reference

Account.prototype.fetchSubscriptions = function(callback)
{
	var self = this;
	if (!self.cache)
		self.cache = { billingInfo: null, subscriptions: [] };

	if (self.cache.subscriptions.length)
		return callback(null, self.cache.subscriptions);

	if (!self.subscriptions || !self.subscriptions.href)
		return callback(null, self.cache.subscriptions);

	RecurlyData.fetchAll(Subscription, this.subscriptions.href, function(err, results)
	{
		if (err)
			return callback(err);

		self.cache.subscriptions = results;
		callback(null, self.cache.subscriptions);
	});
};

var BillingInfo; // forward reference

Account.prototype.fetchBillingInfo = function(callback)
{
	var self = this;
	if (!self.cache)
		self.cache = { billingInfo: null, subscriptions: [] };

	if (self.cache.billingInfo)
		return callback(null, self.cache.billingInfo);

	var binfo =	 new BillingInfo();
	binfo.account_code = self.id;

	binfo.fetch(function(err)
	{
		if (err)
			return callback(err);

		self.cache.billingInfo = binfo;
		callback(null, self.cache.billingInfo);
	});
};

Account.create = function(data, callback)
{
	// Save this new account with recurly.
	if (data.id)
	{
		data.account_code = data.id;
		delete data.id;
	}

	if (!data.account_code)
		throw(new Error('you must supply an id or account_code for new accounts'));

	// TODO optional BillingInfo object

	var body = data2xml(Account.singular, data);

	RecurlyData.post(Account.ENDPOINT, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [201, 422]);
		if (error && (response.statusCode !== 422))
			return callback(error);

		var account = new Account();
		account.id = data.account_code;

		if (response.statusCode === 201)
		{
			// Account created as normal.
			account.inflate(payload);
			return callback(null, account);
		}

		if (response.statusCode === 422)
		{
			// An account with this ID exists already but in closed state.
			return account.reopen(callback);
		}

		callback(new Error('unexpected status: ' + response.statusCode));
	});
};

Account.prototype.update = function(callback)
{
	var self = this;
	var new_data = {
		username: this.username,
		email: this.email,
		first_name: this.first_name,
		last_name: this.last_name,
		company_name: this.company_name,
		accept_language: this.accept_language
	};

	var body = data2xml(Account.singular, new_data);

	RecurlyData.put(self.href, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null, self);
	});
};

Account.prototype.reopen = function(callback)
{
	var self = this;

	var uri = self.href + '/reopen';
	RecurlyData.put(uri, null, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);
		self.inflate(payload);
		callback(null, self);
	});
};

// A little sugar for closing an account.
Account.prototype.close = Account.prototype.destroy;


// ----------------------------------------------------------------------

var Addon = RecurlyData.buildPrototype({
	properties: [
		'add_on_code',
		'created_at',
		'default_quantity',
		'display_quantity_on_hosted_page',
		'href',
		'name',
		'unit_amount_in_cents'
	],
	idField: 'add_on_code',
	plural: 'add_ons',
	singular: 'add_on'
});

// ----------------------------------------------------------------------

var BillingInfo = RecurlyData.buildPrototype({
	properties: [
		'account',
		'address1',
		'address2',
		'card_type',
		'city',
		'company',
		'country',
		'first_name',
		'first_six',
		'href',
		'ip_address',
		'ip_address_country',
		'last_four',
		'last_name',
		'month',
		'phone',
		'state',
		'vat_number',
		'year',
		'zip'
	],
	idField: 'add_on_code',
	plural: 'billing_info',
	singular: 'billing_info'
});

BillingInfo.prototype.__defineGetter__('account_code', function() { return this.account_code; });
BillingInfo.prototype.__defineSetter__('account_code',	function(account_code)
{
	this.properties.account_code = account_code;
	if (!this.href)
		this.href = Account.ENDPOINT + '/' + account_code + '/billing_info';
});

BillingInfo.prototype.update = function(options, callback)
{
	var self = this;

	if (!options.first_name)
		throw(new Error('billing info must include "first_name" parameter'));
	if (!options.last_name)
		throw(new Error('billing info must include "last_name" parameter'));
	if (!options.number)
		throw(new Error('billing info must include "number" parameter'));
	if (!options.month)
		throw(new Error('billing info must include "month" parameter'));
	if (!options.year)
		throw(new Error('billing info must include "year" parameter'));
	if (!options.verification_value)
		throw(new Error('billing info must include "verification_value" parameter'));

	if (!this.href)
		throw(new Error('must set an account_code that this billing info belongs to'));

	var body = data2xml(BillingInfo.singular, options);
	RecurlyData.put(this.href, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200, 201]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};

// ----------------------------------------------------------------------
// TODO

// https://api.recurly.com/v2/accounts/:account_code/redemption
// gets coupon redemptions for an account; should probably be a method on account

var Redemption = RecurlyData.buildPrototype({
	properties: [
		'created_at',
		'currency',
		'single_use',
		'state',
		'total_discounted_in_cents',
	],
	idField: '',
	plural: 'redemptions',
	singular: 'redemption'
});

// also https://api.recurly.com/v2/invoices/:invoice_number/redemption

// ----------------------------------------------------------------------

var Coupon = RecurlyData.buildPrototype({
	properties: [
		'applies_for_months',
		'applies_to_all_plans',
		'coupon_code',
		'created_at',
		'discount_percent',
		'discount_type',
		'max_redemptions',
		'name',
		'plan_codes',
		'redeem_by_date',
		'redemptions',
		'single_use',
		'state'
	],
	idField: 'coupon_code',
	plural: 'coupons',
	singular: 'coupon'
});

Coupon.validDiscountTypes = ['percent', 'dollars' ];

Coupon.create = function(options, callback)
{
	if (!options.coupon_code)
		throw(new Error('coupon options must include "coupon_code" parameter'));
	if (!options.name)
		throw(new Error('coupon options must include "name" parameter'));
	if (!options.discount_type)
		throw(new Error('coupon options must include "discount_type" parameter'));
	if (Coupon.validDiscountTypes.indexOf(options.discount_type) === -1)
		throw(new Error('discount_type must be one of ' + JSON.stringify(Coupon.validDiscountTypes)));

	if (options.hasOwnProperty('applies_to_all_plans') && !options.applies_to_all_plans)
	{
		// Defaults to true. If it's false, plan_codes must be an array.
		if (!options.plan_codes && !Array.isArray(options.plan_codes))
			throw(new Error('coupons that do not apply to all plans must specify plan_codes'));
	}

	var body = data2xml(Plan.singular, options);
	RecurlyData.post(Coupon.ENDPOINT, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [201]);
		if (error)
			return callback(error);

		var item = new Coupon();
		item.inflate(payload);
		callback(null, item);
	});

};

// redeem POST
// requires account_code & currency, responds with 201
// creates a redemption object

Coupon.prototype.redeem = function(options, callback)
{
	var self = this;

	var body = data2xml(Coupon.singular, options);
	RecurlyData.put(this.href, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200, 201]);
		if (error)
			return callback(error);

		var redemption = new Redemption();
		redemption.inflate(payload);
		callback(null, redemption);
	});

};


// ----------------------------------------------------------------------
// TODO

var Invoice = RecurlyData.buildPrototype({
	properties: [
		'account',
		'adjustment',
		'created_at',
		'currency',
		'invoice_number',
		'line_items',
		'po_number',
		'state',
		'subtotal_in_cents',
		'tax_in_cents',
		'total_in_cents',
		'transactions',
		'uuid',
		'vat_number',
	],
	idField: 'uuid',
	plural: 'invoices',
	singular: 'invoice'
});

// ----------------------------------------------------------------------
// A list of plans associated with this recurly payment provider.

var Plan = RecurlyData.buildPrototype({
	properties: [
		'accounting_code',
		'add_ons',
		'bypass_hosted_confirmation',
		'cancel_url',
		'created_at',
		'description',
		'display_donation_amounts',
		'display_phone_number',
		'display_quantity',
		'name',
		'payment_page_tos_link',
		'plan_code',
		'plan_interval_length',
		'plan_interval_unit',
		'setup_fee_in_cents',
		'success_url',
		'trial_interval_length',
		'trial_interval_unit',
		'unit_amount_in_cents',
		'unit_name'
	],
	idField: 'plan_code',
	plural: 'plans',
	singular: 'plan'
});

Plan.all = function(callback)
{
	if (Plan.__all)
		return callback(Plan.__all);

	RecurlyData.fetchAll(Plan, Plan.ENDPOINT, function(err, results)
	{
		Plan.__all = {};
		_.each(results, function(plan)
		{
			Plan.__all[plan.plan_code] = plan;
		});
		callback(Plan.__all);
	});
};

Plan.prototype.fetchAddOns = function(callback)
{
	if	(this._addons)
		return callback(this._addons);

	RecurlyData.fetchAll(Addon, this.addons, function(err, results)
	{
		this.addons = {};
		_.each(results, function(addon)
		{
			this._addons[addon.add_on_code] = addon;
		});
		callback(this._addons);
	});
};

Plan.create = function(options, callback)
{
	if (!options.plan_code)
		throw(new Error('plan options must include "plan_code" parameter'));
	if (!options.name)
		throw(new Error('plan options must include "name" parameter'));
	if (!options.unit_amount_in_cents)
		throw(new Error('plan options must include "unit_amount_in_cents" parameter'));

	var body = data2xml(Plan.singular, options);
	RecurlyData.post(Plan.ENDPOINT, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [201]);
		if (error)
			return callback(error);

		var item = new Plan();
		item.inflate(payload);
		callback(null, item);
	});
};

Plan.prototype.update = function(options, callback)
{
	var self = this;
	if (!self.href)
		throw(new Error('cannot update a plan without an href ' + self.id));

	var body = data2xml(Plan.singular, options);

	RecurlyData.put(self.href, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};



// ----------------------------------------------------------------------

var Subscription = RecurlyData.buildPrototype({
	properties: [
		'account',
		'activated_at',
		'canceled_at',
		'currency',
		'current_period_ends_at',
		'current_period_started_at',
		'expires_at',
		'href',
		'plan',
		'quantity',
		'state',
		'subscription_add_ons',
		'trial_ends_at',
		'trial_started_at',
		'unit_amount_in_cents',
		'uuid'
	],
	idField: 'uuid',
	plural: 'subscriptions',
	singular: 'subscription'
});

Subscription.prototype.__defineGetter__('account_id', function()
{
	if (!this.account)
		return undefined;

	// The account property points to a hash with an href that can be used to fetch
	// the account, but sometimes I want the id.
	this._account_id = this.account.href.match(/\/([^\/]*)$/)[1];
	return this._account_id;
});

Subscription.create = function(options, callback)
{
	if (!options.plan_code)
		throw(new Error('subscription must include "plan_code" parameter'));
	if (!options.account)
		throw(new Error('subscription must include "account" information'));
	if (!options.account.account_code)
		throw(new Error('subscription account info must include "account_code"'));
	if (!options.currency)
		throw(new Error('subscription must include "currency" parameter'));

	var body = data2xml(Subscription.singular, options);
	RecurlyData.post(Subscription.ENDPOINT, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200, 201]);
		if (error)
			return callback(error);

		var sub = new Subscription();
		sub.inflate(payload);
		callback(null, sub);
	});
};

Subscription.prototype.update = function(options, callback)
{
	var self = this;

	if (!options.timeframe)
		throw(new Error('subscription update must include "timeframe" parameter'));
	if (!self.href)
		throw(new Error('cannot update a subscription without an href ' + self.id));

	var body = data2xml(Subscription.singular, options);

	RecurlyData.put(self.href, body, function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200, 201]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};

Subscription.prototype.cancel = function(callback)
{
	var self = this;

	if (!this.id)
		throw(new Error('cannot cancel a subscription without a uuid'));

	var href;
	if (this.a && this.a.cancel)
		href = this.a.cancel.href;
	else
		href = Subscription.ENDPOINT + this.id + '/cancel';

	RecurlyData.put(href, '', function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};

Subscription.prototype.reactivate = function(callback)
{
	var self = this;

	if (!this.id)
		throw(new Error('cannot reactivate a subscription without a uuid'));

	var href;
	if (this.a && this.a.reactivate)
		href = this.a.reactivate.href;
	else
		href = Subscription.ENDPOINT + this.id + '/reactivate';

	RecurlyData.put(href, '', function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};

Subscription.prototype.postpone = function(nextRenewal, callback)
{
	var self = this;

	if (!this.id)
		throw(new Error('cannot postpone a subscription without a uuid'));
	if (!nextRenewal || (typeof nextRenewal !== 'object'))
		throw(new Error(nextRenewal + ' must be a valid renewal date'));

	var href;
	if (this.a && this.a.postpone)
		href = this.a.postpone.href;
	else
		href = Subscription.ENDPOINT + this.id + '/postpone';

	var query = { next_renewal_date: nextRenewal.toISOString() };
	href += '?' + querystring.stringify(query);

	RecurlyData.put(href, '', function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};


Subscription.prototype.validRefundTypes = ['partial', 'full', 'none'];

Subscription.prototype.terminate = function(refundType, callback)
{
	var self = this;

	if (!this.id)
		throw(new Error('cannot terminate a subscription without a uuid'));
	if (this.validRefundTypes.indexOf(refundType) === -1)
		throw(new Error('refund type ' + refundType + ' not valid'));

	var href;
	if (this.a && this.a.terminate)
		href = this.a.terminate.href;
	else
		href = Subscription.ENDPOINT + this.id + '/terminate';

	var query = { refund: refundType };
	href += '?' + querystring.stringify(query);

	RecurlyData.put(href, '', function(err, response, payload)
	{
		var error = handleRecurlyError(err, response, payload, [200, 201]);
		if (error)
			return callback(error);

		self.inflate(payload);
		callback(null);
	});
};

// ----------------------------------------------------------------------
// TODO

var Transaction = RecurlyData.buildPrototype({
	properties: [
		'account',
		'action',
		'amount_in_cents',
		'avs_result',
		'avs_result_postal',
		'avs_result_street',
		'created_at',
		'currency',
		'cvv_result',
		'details',
		'href',
		'invoice',
		'reference',
		'refundable',
		'status',
		'subscription',
		'tax_in_cents',
		'test',
		'uuid',
		'voidable'
	],
	idField: 'uuid',
	plural: 'transactions',
	singular: 'transaction'
});

Transaction.prototype.refund = function(callback)
{
	callback('unimplemented');
};

// ----------------------------------------------------------------------

function FormResponseToken(token, transactionType)
{
	// TODO do this more cleverly
	this.kind = transactionType;
	switch (transactionType)
	{
	case 'billing-info':
		this.builder = BillingInfo;
		break;

	case 'one-time-transaction':
		this.builder = Transaction;
		break;

	case 'subscription':
		this.builder = Subscription;
		break;

	default:
		throw(new Error('unknown recurly transaction type ' + transactionType));
	}

	this.token = token;
}
util.inherits(FormResponseToken, RecurlyData);

FormResponseToken.prototype.process = function(callback)
{
	// Fetch the transaction response pointed to by this token & return the
	// appropriate object

	var self = this;
	var uri = ENDPOINT + 'recurly_js/result/' + this.token;

	RecurlyData.get(uri, {}, function(err, response, payload)
	{
		if (err)
			callback(err);

		if (!payload || (typeof payload !== 'object'))
			return callback(null, payload);

		try
		{
			var result = new self.builder();
			result.inflate(payload);
			callback(null, result);
		}
		catch (ex)
		{
			callback(null, payload);
		}
	});
};


// ----------------------------------------------------------------------

exports.Account = Account;
exports.Addon = Addon;
exports.BillingInfo = BillingInfo;
exports.Coupon = Coupon;
exports.Invoice = Invoice;
exports.Plan = Plan;
exports.Redemption = Redemption;
exports.Subscription = Subscription;
exports.Transaction = Transaction;
exports.FormResponseToken = FormResponseToken;
exports.setAPIKey = setAPIKey;

