/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should()
	;

var
	helpers = require('./helpers'),
	parser = require('../lib/parser'),
	recurly = require('../lib/recurly'),
	util = require('util')
	;


var config, rparser;
var plan, account, subscription;

before(function()
{
	rparser = parser.createParser();
    config = helpers.readTestConfig();
    recurly.setAPIKey(config.apikey);
});

describe('Plan', function()
{
	var cached;

    it('can fetch all plans from the test Recurly account', function(done)
    {
        recurly.Plan.all(function(plans)
        {
            plans.should.be.an('object');
            var plan_codes = Object.keys(plans);
            expect(plan_codes.length).to.be.above(0);
            plan_codes[0].should.not.equal('undefined');
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
            should.not.exist(err);
            plan.href.length.should.be.above(0);
            plan.should.have.property('name');
            plan.should.have.property('description');
            plan.name.should.be.ok;
            plan.description.should.be.ok;
            done();
        });
    });
});

describe('Account', function()
{
	var cached;

    it('can fetch all accounts from the test Recurly account', function(done)
    {
        recurly.Account.all(function(accounts)
        {
            accounts.should.be.an('object');
            var uuids = Object.keys(accounts);
            expect(uuids.length).to.be.above(0);
            uuids[0].should.not.equal('undefined');
            cached = uuids;
            done();
        });
    });

    it('can fetch a single account', function(done)
    {
        account = new recurly.Account();
        account.id = cached[0];
        account.fetch(function(err)
        {
            should.not.exist(err);
            account.should.be.an('object');
            done();
        });
    });

    it('can serialize an account to xml', function(done)
    {
        var xml = account.serialize();
        console.log(xml);
        done();
    });
});

describe('Subscription', function()
{
	var cached, subscription;

    it('can fetch all subscriptions associated with an account', function(done)
    {
        account.fetchSubscriptions(function(err, subscriptions)
        {
            should.not.exist(err);
            subscriptions.should.be.an('array');
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
            should.not.exist(err);
            subscription.account.should.be.an('object');
            subscription.account.should.have.property('href');
            subscription.account_id.should.equal(account.id);

            // TODO
            done();
        });
    });

    it('can create a subscription', function(done)
    {
        //subscription = new recurly.Subscription();
        //subscription.plan_code = '';
        //subscription.account = '';
        //subscription.currency = '';
        done();
    });


    it('throws an error when attempting to modify a subscription without a timeframe', function(done)
    {
        var wrong = function()
        {
            subscription.update({ inadequate: true }, function() {} );
        };
        expect(wrong).to.throw(Error);


        done();
    });

    it('can modify a subscription', function(done)
    {
        var mods = {
            timeframe: 'now',
            quantity: subscription.quantity + 3,
        };

        subscription.update(mods, function(err, updated)
        {
            should.not.exist(err);
            updated.should.be.an('object');
            updated.quantity.should.equal(mods.quantity);
            done();
        });
    });

    it('can postpone a subscription', function(done)
    {
        done();
    });

    it('can cancel a subscription', function(done)
    {
        done();
    });

    it('can terminate a subscription', function(done)
    {
        done();
    });
});


describe('BillingInfo', function()
{
    var binfo;

    it('can fetch the billing info for an account', function(done)
    {
        account.fetchBillingInfo(function(err, info)
        {
            should.not.exist(err);
            binfo = info;
            // er, what to test?
            done();
        });
    });
});

