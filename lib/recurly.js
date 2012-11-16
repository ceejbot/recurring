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
				return callback(err, response.statusCode, {});
			}

			callback(null, response.statusCode, result);
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
		if (err)
		{
			console.error('recurly.del', 'error ' + JSON.stringify(err));
			return callback(err);
		}
		if (response.statusCode !== 204)
			return callback(new Error('statusCode: ' + response.statusCode));

		callback(null, true);
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

	RecurlyData.get(self.href, {}, function(err, statusCode, payload)
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
	properties: [ 'account_code', 'state', 'username', 'email', 'first_name', 'last_name', 'accept_language',  'created_at'],
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

	RecurlyData.post(Account.ENDPOINT, body, function(err, statusCode, payload)
	{
		if (err)
			return callback(err);
		if (statusCode === 201)
		{
			var account = new Account();
			account.id = data.account_code;
			account.inflate(payload);
			return callback(null, account);
		}

		if (statusCode === 422)
		{
			var account = new Account();
			account.id = data.account_code;
			return account.reopen(callback);
		}

		callback(statusCode);
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

	RecurlyData.put(self.href, body, function(err, statusCode, payload)
	{
		if (err)
			return callback(err, self);
		self.inflate(payload);
		callback(null, self);
	});
};

Account.prototype.reopen = function(callback)
{
	var self = this;

	var uri = self.href + '/reopen';
	RecurlyData.put(uri, null, function(err, status, payload)
	{
		if (err)
			return callback(err, self);
		self.inflate(payload);
		callback(null, self);
	});
};

Account.prototype.close = function(callback)
{
	var self = this;

	RecurlyData.destroy(self.href, function(err, deleted)
	{
		self.deleted = deleted;
		callback(err, deleted);
	});
};

// ----------------------------------------------------------------------

var Addon = RecurlyData.buildPrototype({
	properties: [ 'add_on_code', 'name', 'display_quantity_on_hosted_page', 'default_quantity', 'unit_amount_in_cents', 'created_at', 'href'],
	idField: 'add_on_code',
	plural: 'add_ons',
	singular: 'add_on'
});

// ----------------------------------------------------------------------

var BillingInfo = RecurlyData.buildPrototype({
	properties: [
		'account', 'first_name', 'last_name', 'company',
		'address1', 'address2', 'city', 'state', 'zip', 'country', 'phone',
		'vat_number', 'ip_address', 'ip_address_country',
		'card_type', 'year', 'month', 'first_six', 'last_four', 'href'
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
	RecurlyData.put(this.href, body, function(err, statusCode, payload)
	{
		if (err)
			return callback(err, self);

		self.inflate(payload);
		callback(null, self);
	});
};


// ----------------------------------------------------------------------
// TODO

var Coupon = RecurlyData.buildPrototype({
	properties: [ 'href' ],
	idField: 'add_on_code',
	plural: 'coupons',
	singular: 'coupon'
});

// ----------------------------------------------------------------------
// TODO

var Invoice = RecurlyData.buildPrototype({
	properties: [ 'href' ],
	idField: 'add_on_code',
	plural: 'invoices',
	singular: 'invoice'
});

// ----------------------------------------------------------------------
// A list of plans associated with this recurly payment provider.

var Plan = RecurlyData.buildPrototype({
	properties: [ 'add_ons', 'plan_code', 'name', 'description', 'success_url',
	'cancel_url', 'display_donation_amounts', 'display_quantity',
	'display_phone_number', 'bypass_hosted_confirmation', 'unit_name',
	'payment_page_tos_link', 'plan_interval_length',
	'plan_interval_unit', 'trial_interval_length',
	'trial_interval_unit', 'accounting_code', 'created_at',
	'unit_amount_in_cents', 'setup_fee_in_cents' ],
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

// ----------------------------------------------------------------------

var Subscription = RecurlyData.buildPrototype({
	properties: [ 'href', 'account', 'plan', 'uuid', 'state',
	'unit_amount_in_cents', 'currency', 'quantity', 'activated_at',
	'canceled_at', 'expires_at', 'current_period_started_at',
	'current_period_ends_at', 'trial_started_at', 'trial_ends_at',
	'subscription_add_ons',	 ],
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

Subscription.prototype.update = function(options, callback)
{
	var self = this;

	if (!options.timeframe)
		throw(new Error('subscription update must include "timeframe" parameter'));
	if (!self.href)
		throw(new Error('cannot update a subscription without an href ' + self.id));

	var body = data2xml(Subscription.singular, options);

	RecurlyData.put(self.href, body, function(err, statusCode, payload)
	{
		if (err)
			return callback(err, self);
		self.inflate(payload);
		callback(null, self);
	});
};

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
	RecurlyData.post(Subscription.ENDPOINT, body, function(err, statusCode, payload)
	{
		if (err)
			return callback(err, self);

		var sub = new Subscription();
		sub.inflate(payload);
		callback(null, sub);
	});
};


Subscription.prototype.cancel = function(callback)
{
	// this.a.cancel object
	callback('unimplemented');
};

Subscription.prototype.terminate = function(callback)
{
	// this.a.terminate object
	callback('unimplemented');
};

Subscription.prototype.postpone = function(callback)
{
	// this.a.postpone object

	callback('unimplemented');
};

// ----------------------------------------------------------------------

var Transaction = RecurlyData.buildPrototype({
	properties: [ 'href', 'account', 'invoice', 'subscription', 'uuid', 'action',
	'amount_in_cents', 'tax_in_cents', 'currency', 'status',
	'reference', 'test', 'voidable', 'refundable', 'cvv_result',
	'avs_result', 'avs_result_street', 'avs_result_postal',
	'created_at', 'details', ],
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

	RecurlyData.get(uri, {}, function(err, statusCode, payload)
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
exports.Subscription = Subscription;
exports.Transaction = Transaction;
exports.FormResponseToken = FormResponseToken;
exports.setAPIKey = setAPIKey;

