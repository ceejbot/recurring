/*jshint node:true */

var
	_           = require('lodash'),
	data2xml    = require('data2xml'),
	path        = require('path'),
	querystring = require('querystring'),
	request     = require('request'),
	rparser     = require('./parser.js'),
	util        = require('util')
	;
//----------------------------------------------------------------------------------------

function Recurring()
{

	var
		ENDPOINT = 'https://api.recurly.com/v2/',
		APIKEY, AUTH_BASIC,
		parser = rparser.createParser()
		;

	function setAPIKey(key)
	{
		APIKEY = key;
		AUTH_BASIC = 'Basic ' + (new Buffer(APIKEY + ':', 'ascii')).toString('base64');
	}

	//----------------------------------------------------------------------------------------

	function RecurlyError(struct)
	{
		this.name = 'RecurlyError';

		this.errors = [];
		if (typeof struct === 'string')
		{
			this.message = struct;
		}
		else if (struct.symbol)
		{
			this.errors.push(struct);
			this.message = struct.description;
		}
		else
		{
			var keys = Object.keys(struct);
			for (var i = 0; i < keys.length; i++)
			{
				// massage the output a little bit.
				var err = struct[keys[i]];
				err.message = err['#'];
				delete err['#'];
				this.errors.push(err);
			}

			if (this.errors.length === 1)
				this.message = this.errors[0].message;
			else
				this.message = this.errors.length + ' transaction errors';
		}
	}
	util.inherits(RecurlyError, Error);

	function handleRecurlyError(err, response, payload, validStatuses)
	{
		if (err)
			return err;
		if (!response)
			return new Error('no response object');
		if (payload && payload.hasOwnProperty('error'))
			return new RecurlyError(payload.error);
		if ((response.statusCode === 400) && payload && (typeof payload === 'object'))
			return new RecurlyError(payload);

		var idx = validStatuses.indexOf(response.statusCode);
		if (idx === -1)
			return new Error('unexpected status: ' + response.statusCode);

	}

	//----------------------------------------------------------------------------------------

	function RecurlyData()
	{
	}

	RecurlyData.base_options = function()
	{
		return {
			headers:
			{
				Accept: 'application/xml',
				Authorization: AUTH_BASIC
			}
		};
	};

	function execute(options, callback)
	{
		request(options, function(err, response, body)
		{
			if (err)
			{
				console.error('recurly.' + options.method, 'error ' + JSON.stringify(err));
				return callback(err, response, {});
			}

			if (response.statusCode === 404)
				return callback(new Error('not_found'), response, {});

			if (options.noParse) return callback(err, response, body);

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

	RecurlyData.go = function(method, uri, args, opts, callback)
	{
		if (!callback && typeof opts === 'function')
		{
			callback = opts;
			opts = {};
		}

		var options = _.assign({}, RecurlyData.base_options(), opts);
		options.uri = uri;

		if (method === 'GET')
			options.qs = args;
		else
			options.body = args;

		options.method = method;

		execute(options, callback);
	};

	RecurlyData.get = RecurlyData.go.bind(RecurlyData, 'GET');

	RecurlyData.put = RecurlyData.go.bind(RecurlyData, 'PUT');

	RecurlyData.post = RecurlyData.go.bind(RecurlyData, 'POST');

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
			// TODO throw an error
			console.log(json);
			return;
		}

		var keys = Object.keys(json);
		for (var i = 0; i < keys.length; i++)
		{
			var prop = keys[i];
			var value = json[prop];

			if ('a' === prop)
			{
				// Hackery. 'a' is a list of named anchors. We treat them specially.
				this.a = {};
				var anchors = Object.keys(value);
				for (var j = 0; j < anchors.length; j++)
				{
					var anchor = value[anchors[j]];
					this.a[anchor.name] =  anchor;
				}
			}
			else if (value.hasOwnProperty('href') && (Object.keys(value).length === 1))
			{
				if (!this._resources)
					this._resources = {};
				this._resources[prop] = value.href;
			}
			else
				this[prop] = value;
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
			if (response.statusCode === 404)
				return callback(new Error('not_found'));

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

		var continuer = function(err, response, records)
		{
			if (err)
				return finished(err);

			// link header in response points to next page of results
			// X-Records header says how many total
			if (total < 0)
				total = parseInt(response.headers['x-records'], 10);

			_.each(records, function(record)
			{
				var item = new Model();
				item.inflate(record);
				result.push(item);
			});

			if ((result.length >= total) || !response.headers.link )
				return finished(null);

			uri = response.headers.link.split('; rel="next"')[0].split(',').pop().trim().slice(1, -1);

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
			this._resources = {};
		};
		util.inherits(constructor, RecurlyData);

		for (var i = 0; i < options.properties.length; i++)
			RecurlyData.addProperty(constructor, options.properties[i]);
		constructor.prototype.proplist = options.properties;

		constructor.ENDPOINT = ENDPOINT + options.plural;
		constructor.plural = options.plural; // used when generating xml
		constructor.singular = options.singular;

		constructor.prototype.__defineGetter__('id', function()
		{
			return this.properties[options.idField];
		});

		var idSetter = function()
		{
			var newval = arguments['0'];
			this.properties[options.idField] = newval;
			this.href = constructor.ENDPOINT + '/' + newval;
		};
		constructor.prototype.__defineSetter__('id', idSetter);
		constructor.prototype.__defineSetter__(options.idField, idSetter);

		return constructor;
	};

	RecurlyData.addProperty = function(constructor, propname)
	{
		var getterFunc = function()
		{
			return this.properties[propname];
		};
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

	var Transaction; // forward reference

	Account.prototype.fetchTransactions = function(callback)
	{
		var self = this;
		if (self.transactions && Array.isArray(self.transactions))
			return callback(null, self.transactions);

		var uri = self._resources.transactions || (self.href + '/transactions');

		RecurlyData.fetchAll(Transaction, uri, function(err, results)
		{
			if (err)
				return callback(err);

			self.transactions = results;
			callback(null, self.transactions);
		});
	};

	var Subscription; // forward reference

	Account.prototype.fetchSubscriptions = function(callback)
	{
		var self = this;
		if (self.subscriptions && Array.isArray(self.subscriptions))
			return callback(null, self.subscriptions);

		var uri = self._resources.subscriptions || (self.href + '/subscriptions');

		RecurlyData.fetchAll(Subscription, uri, function(err, results)
		{
			if (err)
				return callback(err);

			self.subscriptions = results;
			callback(null, self.subscriptions);
		});
	};

	var BillingInfo; // forward reference

	Account.prototype.fetchBillingInfo = function(callback)
	{
		var self = this;
		if (self.billingInfo)
			return callback(null, self.billingInfo);

		var binfo = new BillingInfo();
		binfo.account_code = self.id;

		binfo.fetch(function(err)
		{
			if (err)
				return callback(err);

			self.billingInfo = binfo;
			callback(null, self.billingInfo);
		});
	};

	var Redemption; // forward reference

	Account.prototype.fetchRedeemedCoupons = function(callback)
	{
		var self = this;
		if (self.redeemedInfo)
			return callback(null, self.redeemedInfo);

		var rinfo = new Redemption();
		rinfo.account_code = self.id;

		rinfo.fetch(function(err)
		{
			if (err)
				return callback(err);

			self.redeemedInfo = rinfo;
			callback(null, self.redeemedInfo);
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
				// An account with this ID exists already but in closed state. Reopen it.
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

		if (this.billing_info)
			new_data.billing_info = this.billing_info;

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

	Account.prototype.getInvoices = function(callback)
	{
		var self = this;
		var uri = self.href + '/invoices';

		RecurlyData.get(uri, null, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200]);
			if (error)
				return callback(error);

			self.invoices = payload;
			callback(null, self.invoices);
		});
	};

	Account.prototype.getRedemptions = function(callback)
	{
		var self = this;
		var uri = self.href + '/redemption';

		RecurlyData.get(uri, null, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200]);
			if (error)
				return callback(error);

			self.redemptions = payload;
			callback(null, self.redemptions);
		});
	};

	Account.prototype.getAdjustments = function(callback)
	{
		var self = this;
		var uri = self.href + '/adjustments';

		RecurlyData.get(uri, null, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200]);
			if (error)
				return callback(error);

			self.redemptions = payload;
			callback(null, self.redemptions);
		});
	};

	Account.prototype.createAdjustment = function(opts, callback)
	{
		var self = this;
		var uri = self.href + '/adjustments';

		var body = data2xml(Adjustment.singular, opts);

		RecurlyData.post(uri, body, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200, 201]);
			if (error)
				return callback(error);

			callback(null, payload);
		});
	};

	Account.prototype.createInvoice = function(callback)
	{
		var self = this;
		var uri = self.href + '/invoices';

		RecurlyData.post(uri, null, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200, 201]);
			if (error)
				return callback(error);

			callback(null, payload);
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

	BillingInfo = RecurlyData.buildPrototype({
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

	BillingInfo.prototype.__defineGetter__('account_code', function()
	{
		return this.account_code;
	});

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

	Redemption = RecurlyData.buildPrototype({
		properties: [
			'created_at',
			'currency',
			'single_use',
			'state',
			'total_discounted_in_cents'
		],
		idField: '',
		plural: 'redemptions',
		singular: 'redemption'
	});

	Redemption.prototype.__defineGetter__('account_code', function()
	{
		return this.account_code;
	});

	Redemption.prototype.__defineSetter__('account_code',  function(account_code)
	{
		this.properties.account_code = account_code;
		if (!this.href)
			this.href = Account.ENDPOINT + '/' + account_code + '/redemption';
	});

	var Adjustment = RecurlyData.buildPrototype({
		properties: [
			'created_at',
			'currency',
			'single_use',
			'state',
			'total_discounted_in_cents'
		],
		idField: '',
		plural: 'adjustments',
		singular: 'adjustment'
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

		var body = data2xml(Coupon.singular, options);

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

	Coupon.prototype.redeem = function(options, callback)
	{
		var self = this;

		if (!options.account_code)
			throw(new Error('coupon redemption options must include "account_code" parameter'));
		if (!options.currency)
			throw(new Error('coupon redemption options must include "currency" parameter'));

		var body = data2xml(Redemption.singular, options);
		var href = this.href + '/redeem';

		RecurlyData.post(href, body, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200, 201]);
			if (error)
				return callback(error);

			var redemption = new Redemption();
			redemption.inflate(payload);
			callback(null, redemption);
		});

	};

	Coupon.all = function(callback)
	{
		if (Coupon.__all)
			return callback(Coupon.__all);

		RecurlyData.fetchAll(Coupon, Coupon.ENDPOINT, function(err, results)
		{
			Coupon.__all = {};
			_.each(results, function(coupon)
			{
				Coupon.__all[coupon.coupon_code] = coupon;
			});
			callback(Coupon.__all);
		});
	};

	// ----------------------------------------------------------------------
	//
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
			'vat_number'
		],
		idField: 'uuid',
		plural: 'invoices',
		singular: 'invoice'
	});

	Invoice.all = function(callback)
	{
		if (Invoice.__all)
			return callback(Invoice.__all);

		RecurlyData.fetchAll(Invoice, Invoice.ENDPOINT, function(err, results)
		{
			Invoice.__all = {};
			_.each(results, function(invoice)
			{
				Invoice.__all[invoice.uuid] = invoice;
			});
			callback(Invoice.__all);
		});
	};

	Invoice.prototype.fetchPDF = function(callback)
	{
		var self = this;

		if (!self.href)
			throw(new Error('cannot fetch a record without an href'));

		RecurlyData.get(self.href, {}, {
			headers: {
				Accept: 'application/pdf'
			},
			encoding: null,
			noParse: true
		}, function(err, response, payload)
		{
			if (err)
				return callback(err);
			if (response.statusCode === 404)
				return callback(new Error('not_found'));

			callback(err, payload);
		});
	};

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

	Subscription = RecurlyData.buildPrototype({
		properties: [
			'account',
			'activated_at',
			'bank_account_authorized_at',
			'canceled_at',
			'collection_method',
			'currency',
			'current_period_ends_at',
			'current_period_started_at',
			'customer_notes',
			'expires_at',
			'href',
			'net_terms',
			'plan',
			'quantity',
			'state',
			'subscription_add_ons',
			'tax',
			'tax_in_cents',
			'tax_type',
			'tax_region',
			'tax_rate',
			'terms_and_conditions',
			'trial_ends_at',
			'trial_started_at',
			'unit_amount_in_cents',
			'uuid',
			'pending_subscription',
			'po_number'
		],
		idField: 'uuid',
		plural: 'subscriptions',
		singular: 'subscription'
	});

	Subscription.all = function(state, callback)
	{
		if (typeof state === 'function')
		{
			callback = state;
			state = 'live';
		}

		if (Subscription.__all && Subscription.__all[state])
			return callback(Subscription.__all[state]);

		if (!Subscription.__all)
			Subscription.__all = {};
		if (!Subscription.__all[state])
			Subscription.__all[state] = {};

		RecurlyData.fetchAll(Subscription, Subscription.ENDPOINT + '?' + querystring.stringify({state: state}), function(err, results)
		{
			var cache = Subscription.__all[state] = results;
			callback(cache);
		});
	};
	Subscription.prototype.__defineGetter__('account_id', function()
	{
		if (this._account_id)
			return this._account_id;
		if (!this._resources.account)
			return undefined;

		// The account property points to a hash with an href that can be used to fetch
		// the account, but sometimes I want the id.
		this._account_id = this._resources.account.match(/\/([^\/]*)$/)[1];
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
			href = Subscription.ENDPOINT + '/' + this.id + '/cancel';

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
			href = Subscription.ENDPOINT + '/' + this.id + '/reactivate';

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
			href = Subscription.ENDPOINT + '/' + this.id + '/postpone';

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
			href = Subscription.ENDPOINT + '/' + this.id + '/terminate';

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

	Transaction = RecurlyData.buildPrototype({
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
			'details', // subobjects account & billing info
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

	Transaction.create = function(options, callback)
	{
		if (!options.account)
			throw(new Error('transaction must include "account" parameter'));
		if (!options.account.account_code)
			throw(new Error('"account" parameter must specify account_code'));
		if (!options.amount_in_cents)
			throw(new Error('transaction must include "amount_in_cents" parameter'));
		if (!options.currency)
			throw(new Error('transaction must include "currency" parameter'));

		var body = data2xml(Transaction.singular, options);
		RecurlyData.post(Transaction.ENDPOINT, body, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [200, 201]);
			if (error)
				return callback(error);

			var transaction = new Transaction();
			transaction.inflate(payload);
			callback(null, transaction);
		});
	};

	Transaction.prototype.refund = function(amount, callback)
	{
		var self = this;
		if (typeof amount === 'function')
		{
			callback = amount;
			amount = null;
		}

		if (!this.id)
			throw(new Error('cannot refund a transaction without an id'));

		var href;
		if (this.a && this.a.refund)
			href = this.a.refund.href;
		else
			href = self.href;

		if (amount)
		{
			var query = { amount_in_cents: amount };
			href += '?' + querystring.stringify(query);
		}

		RecurlyData.destroy(href, function(err, response, payload)
		{
			var error = handleRecurlyError(err, response, payload, [202]);
			if (error)
				return callback(error);

			self.inflate(payload);
			callback(null);
		});
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

	Recurring.prototype.Account = Account;
	Recurring.prototype.Addon = Addon;
	Recurring.prototype.Adjustment = Adjustment;
	Recurring.prototype.BillingInfo = BillingInfo;
	Recurring.prototype.Coupon = Coupon;
	Recurring.prototype.Invoice = Invoice;
	Recurring.prototype.Plan = Plan;
	Recurring.prototype.Redemption = Redemption;
	Recurring.prototype.Subscription = Subscription;
	Recurring.prototype.Transaction = Transaction;
	Recurring.prototype.FormResponseToken = FormResponseToken;
	Recurring.prototype.setAPIKey = setAPIKey;

}

module.exports = function()
{
	return new Recurring();
};
