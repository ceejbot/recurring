/*global describe:true, it:true, before:true, after:true */

var
	demand  = require('must'),
	parser  = require('../lib/parser'),
	recurly = require('../lib/recurly')(),
	util    = require('util'),
	uuid    = require('node-uuid')
	;

// This recurly account is an empty test account connected to their
// development gateway.
var config =
{
	apikey: '8fa00f53641f45c08a1e2be7ab02d163',
	plan_code: 'recurring-test',
	subdomain: 'recurring-test'
};

var noopFunc = function()
{
};

var rparser, plan, account, subscription;
var old_account_id = 'test-account-1';
var fresh_account_id;

before(function()
{
	rparser = parser.createParser();
	recurly.setAPIKey(config.apikey);
});

describe('Plan', function()
{
	var cached;

	// create a plan

	it('can fetch all plans from the test Recurly account', function(done)
	{
		recurly.Plan.all(function(plans)
		{
			plans.must.be.an.object();
			var plan_codes = Object.keys(plans);
			plan_codes.length.must.be.above(0);
			plan_codes[0].must.not.equal('undefined');
			cached = plan_codes;
			done();
		});
	});

	it('can fetch a single plan', function(done)
	{
		plan = new recurly.Plan();
		plan.id = cached[0];
		plan.fetch(function(err)
		{
			demand(err).not.exist();
			plan.href.length.must.be.above(0);
			plan.must.have.property('name');
			plan.must.have.property('description');
			plan.name.must.exist();
			plan.description.must.exist();
			done();
		});
	});

	// modify
});

describe('Account', function()
{
	var cached;

	it('can create an account', function(done)
	{
		fresh_account_id = uuid.v4();
		var data =
		{
			id: fresh_account_id,
			email: 'test@example.com',
			first_name: 'John',
			last_name: 'Whorfin',
			company_name: 'Yoyodyne Propulsion Systems',
		};

		recurly.Account.create(data, function(err, newAccount)
		{
			demand(err).not.exist();
			newAccount.must.be.an.object();
			newAccount.id.must.equal(fresh_account_id);
			newAccount.company_name.must.equal('Yoyodyne Propulsion Systems');
			done();
		});
	});

	it('can close an account', function(done)
	{
		account = new recurly.Account();
		account.id = fresh_account_id;

		account.close(function(err, closed)
		{
			demand(err).not.exist();
			closed.must.equal(true);
			done();
		});
	});

	it('can create or reopen a previously-closed account, transparently', function(done)
	{
		var data = { id: fresh_account_id };

		recurly.Account.create(data, function(err, newAccount)
		{
			demand(err).not.exist();
			newAccount.must.be.an.object();
			newAccount.first_name.must.equal('John'); // from old data
			newAccount.last_name.must.equal('Whorfin'); // from old data
			done();
		});
	});

	it('can fetch a single account', function(done)
	{
		account = new recurly.Account();
		account.id = fresh_account_id;
		account.fetch(function(err)
		{
			demand(err).not.exist();
			account.must.be.an.object();
			account.email.must.equal('test@example.com');
			account.company_name.must.equal('Yoyodyne Propulsion Systems');
			done();
		});
	});

	it('can fetch all accounts from the test Recurly account', function(done)
	{
		recurly.Account.all(function(accounts)
		{
			accounts.must.be.an.object();
			var uuids = Object.keys(accounts);
			uuids.length.must.be.above(0);
			uuids[0].must.not.equal('undefined');
			cached = uuids;
			done();
		});
	});

	it('can update an account', function(done)
	{
		account.company_name = 'Yoyodyne Propulsion, International';
		account.update(function(err, updated)
		{
			demand(err).not.exist();
			updated.must.be.an.object();

			var testAcc = new recurly.Account();
			testAcc.id = account.id;
			testAcc.fetch(function(err)
			{
				demand(err).not.exist();
				testAcc.company_name.must.equal(account.company_name);
				done();
			});
		});
	});
});

describe('BillingInfo', function()
{
	var binfo;

	it('can retrieve billing info for an account that does not exist', function(done)
	{
		var data =
		{
			id: uuid.v4(),
			email: 'test2@example.com',
			first_name: 'John',
			last_name: 'Smallberries',
			company_name: 'Yoyodyne Propulsion Systems',
		};

		recurly.Account.create(data, function(err, newAccount)
		{
			demand(err).not.exist();
			newAccount.fetchBillingInfo(function(err, info)
			{
				err.must.exist();
				err.message.must.equal('not_found');
				demand(info).not.exist();
				done();
			});
		});
	});

	it('can add billing info to an account', function(done)
	{
		binfo = new recurly.BillingInfo();
		binfo.account_code = fresh_account_id;
		var billing_data =
		{
			first_name: account.first_name,
			last_name: account.last_name,
			number: '4111-1111-1111-1111',
			month: 1,
			year: (new Date()).getFullYear() + 3,
			verification_value: '111',
			address1: '760 Market Street',
			address2: 'Suite 500',
			city: 'San Francisco',
			state: 'CA',
			country: 'USA',
			zip: '94102'
		};

		binfo.update(billing_data, function(err)
		{
			demand(err).not.exist();
			binfo.last_four.must.equal('1111');
			done();
		});
	});

	it('throws an error when missing a required billing data field', function(done)
	{
		var binfo2 = new recurly.BillingInfo();
		binfo2.account_code = fresh_account_id;

		var wrong = function()
		{
			var inadequate =
			{
				first_name: account.first_name,
				last_name: account.last_name,
			};
			binfo2.update(inadequate, noopFunc);
		};
		wrong.must.throw(Error);
		done();
	});

	it('can fetch the billing info for an account', function(done)
	{
		account.fetchBillingInfo(function(err, info)
		{
			demand(err).not.exist();
			info.first_name.must.equal(account.first_name);
			info.last_four.must.equal('1111');
			info.address2.must.be.a.string();
			done();
		});
	});
});

describe('Subscription', function()
{
	var cached;

	it('can create a subscription for an account', function(done)
	{
		var data = {
			plan_code: config.plan_code,
			account: { account_code: account.id },
			currency: 'USD',
			quantity: 10,
		};

		recurly.Subscription.create(data, function(err, newsub)
		{
			demand(err).not.exist();
			newsub.id.must.exist();
			newsub.quantity.must.equal(10);
			newsub.plan.must.be.an.object();
			newsub.plan.plan_code.must.equal(config.plan_code);

			subscription = newsub;
			done();
		});
	});

	it('can fetch all subscriptions associated with an account', function(done)
	{
		account.fetchSubscriptions(function(err, subscriptions)
		{
			demand(err).not.exist();
			subscriptions.must.be.an.array();
			cached = subscriptions;
			done();
		});
	});

	it('can fetch a single subscription', function(done)
	{
		var uuid = cached[0].uuid;
		subscription = new recurly.Subscription();
		subscription.id = uuid;
		subscription.fetch(function(err)
		{
			demand(err).not.exist();
			subscription.must.have.property('_resources');
			subscription._resources.must.be.an.object();
			subscription._resources.must.have.property('account');
			subscription.account_id.must.equal(account.id);

			done();
		});
	});

	it('throws an error when attempting to modify a subscription without a timeframe', function(done)
	{
		var wrong = function()
		{
			subscription.update({ inadequate: true }, noopFunc);
		};
		wrong.must.throw(Error);
		done();
	});

	it('can modify a subscription', function(done)
	{
		var mods =
		{
			timeframe: 'now',
			quantity: subscription.quantity + 3,
		};

		subscription.update(mods, function(err)
		{
			demand(err).not.exist();
			subscription.must.be.an.object();
			subscription.quantity.must.equal(mods.quantity);

			done();
		});
	});

	it('can cancel a subscription', function(done)
	{
		subscription.cancel(function(err)
		{
			demand(err).not.exist();
			subscription.state.must.equal('canceled');
			subscription.canceled_at.must.be.a.date();
			subscription.expires_at.must.be.a.date(); // in the future, even

			done();
		});
	});

	it('can reactivate a subscription', function(done)
	{
		subscription.reactivate(function(err)
		{
			demand(err).not.exist();
			subscription.state.must.equal('active');
			subscription.activated_at.must.be.a.date();
			subscription.activated_at.getTime().must.equal(subscription.current_period_started_at.getTime());
			subscription.canceled_at.must.be.a.string();
			subscription.expires_at.must.be.a.string();

			done();
		});
	});

	it('can postpone a subscription', function(done)
	{
		var now = new Date();
		var nextDate = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);

		subscription.postpone(nextDate, function(err)
		{
			demand(err).not.exist();
			nextDate.getTime().must.equal(subscription.current_period_ends_at.getTime());
			done();
		});
	});

	it('can terminate a subscription without a refund', function(done)
	{
		subscription.terminate('none', function(err)
		{
			demand(err).not.exist();
			subscription.state.must.equal('expired');
			subscription.canceled_at.must.be.a.date();
			done();
		});
	});
});

describe('Coupons', function()
{
	var coupon, coupon_code;

	it('can create a coupon', function(done)
	{
		coupon_code = uuid.v4();
		var data =
		{
			coupon_code: coupon_code,
			name: 'Test Coupon',
			discount_type: 'percent',
			discount_percent: 50,
			single_use: true,
			invoice_description: 'The coupon, as invoiced',
			hosted_description: 'This is a description of a coupon',
		};

		recurly.Coupon.create(data, function(err, coup)
		{
			demand(err).not.exist();
			coup.id.must.equal(coupon_code);
			coup.state.must.equal('redeemable');
			coup.single_use.must.equal(true);
			coup.applies_to_all_plans.must.equal(true);
			done();
		});
	});

	it('can fetch a coupon', function(done)
	{
		coupon = new recurly.Coupon();
		coupon.id = coupon_code;
		coupon.fetch(function(err)
		{
			demand(err).not.exist();
			coupon.id.must.equal(coupon_code);
			coupon.state.must.equal('redeemable');
			coupon.single_use.must.equal(true);
			coupon.applies_to_all_plans.must.equal(true);
			coupon.name.must.equal('Test Coupon');
			done();
		});
	});

	it('can redeem a coupon', function(done)
	{
		var options =
		{
			account_code: fresh_account_id,
			currency: 'USD'
		};

		coupon.redeem(options, function(err, redemption)
		{
			demand(err).not.exist();
			redemption._resources.coupon.must.equal(coupon.href);
			redemption.single_use.must.equal(true);
			done();
		});
	});

	// examine a redemption object

	it('can delete a coupon', function(done)
	{
		coupon.destroy(function(err)
		{
			demand(err).not.exist();
			done();
		});
	});
});

describe('Transactions', function()
{
	var trans1, trans2;

	it('requires an account parameter with account code', function()
	{
		var wrong = function()
		{
			var inadequate =
			{
				amount_in_cents: 10,
				currency: 'USD',
			};
			recurly.Transaction.create(inadequate, noopFunc);
		};
		wrong.must.throw(Error);
	});

	it('requires an amount_in_cents parameter when creating a transaction', function()
	{
		var wrong = function()
		{
			var inadequate =
			{
				account: { account_code: fresh_account_id },
				currency: 'USD',
			};
			recurly.Transaction.create(inadequate, noopFunc);
		};
		wrong.must.throw(Error);
	});

	it('requires an currency parameter when creating a transaction', function()
	{
		var wrong = function()
		{
			var inadequate =
			{
				account: { account_code: fresh_account_id },
				amount_in_cents: 10,
			};
			recurly.Transaction.create(inadequate, noopFunc);
		};
		wrong.must.throw(Error);
	});

	it('can create a transaction', function(done)
	{
		var options =
		{
			amount_in_cents: 100,
			currency: 'USD',
			account: { account_code: fresh_account_id }
		};

		recurly.Transaction.create(options, function(err, transaction)
		{
			demand(err).not.exist();
			transaction.action.must.equal('purchase');
			transaction.amount_in_cents.must.equal(100);
			transaction.currency.must.equal('USD');
			transaction.status.must.equal('success');
			transaction.reference.must.exist();
			transaction.voidable.must.equal(true);
			transaction.refundable.must.equal(true);

			transaction.details.must.have.property('account');
			transaction.details.account.account_code.must.equal(fresh_account_id);

			trans1 = transaction;
			done();
		});
	});

	it('can refund a transaction fully', function(done)
	{
		trans1.refund(function(err)
		{
			demand(err).not.exist();
			trans1.status.must.equal('void');
			trans1.voidable.must.equal(false);
			trans1.refundable.must.equal(false);
			done();
		});
	});

	it('can refund a transaction partially', function(done)
	{
		var options =
		{
			amount_in_cents: 500,
			currency: 'USD',
			account: { account_code: fresh_account_id }
		};

		recurly.Transaction.create(options, function(err, transaction)
		{
			demand(err).not.exist();
			transaction.refund(250, function(err)
			{
				demand(err).not.exist();
				transaction.amount_in_cents.must.equal(250);
				transaction.status.must.equal('success');
				transaction.voidable.must.equal(true);
				transaction.refundable.must.equal(false);
				done();
			});
		});
	});

});

describe('RecurlyError', function()
{

	it('calls back with a RecurlyError object on account creation errors', function(done)
	{
		var data =
		{
			id: uuid.v4(),
			email: 'test@example.com2', // Note invalid email address
			first_name: 'John',
			last_name: 'Whorfin',
			company_name: 'Yoyodyne Propulsion Systems',
		};

		recurly.Account.create(data, function(err, newAccount)
		{
			err.must.be.an.object();
			err.must.have.property('errors');
			err.errors.must.be.an.array();
			err.errors.length.must.equal(1);
			err.errors[0].field.must.equal('account.email');
			err.errors[0].symbol.must.equal('invalid_email');
			done();
		});
	});

	it('calls back with a RecurlyError object on transaction errors', function(done)
	{
		var binfo = new recurly.BillingInfo();
		binfo.account_code = fresh_account_id;
		var billing_data =
		{
			first_name: account.first_name,
			last_name: account.last_name,
			number: '4111-1111', // Note invalid format
			month: 1,
			year: 2010,
			verification_value: '111',
		};

		binfo.update(billing_data, function(err)
		{
			err.must.be.an.object();
			err.must.have.property('errors');
			err.errors.must.be.an.array();
			err.errors.length.must.equal(2);
			done();
		});
	});

});

describe('Prerequsites', function()
{
	before(function()
	{
		recurly.setAPIKey('');
	});
	it('should raise an error if the API Key has not been set.', function(done)
	{
		var data =
		{
			id: uuid.v4(),
			email: 'test@example.com',
			first_name: 'John',
			last_name: 'Whorfin',
			company_name: 'Yoyodyne Propulsion Systems',
		};
		recurly.Account.create(data, function(err, newAccount)
		{
			demand(err).exist();
			err.must.be.an(Error);
			done();
		});
	});
	after(function()
	{
		recurly.setAPIKey(config.apikey);
	});
});
