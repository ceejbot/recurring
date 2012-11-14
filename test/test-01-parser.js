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
	util = require('util')
	;


// ----------------------------------------------------------------------

var rparser;

before(function()
{
	rparser = parser.createParser();
});


describe('recurly xml parser', function()
{
	var data = helpers.readFixture('types.xml');
	var typesResult;

	it('can parse basic data types', function(done)
	{
		rparser.parseXML(data, function(err, result)
		{
			should.not.exist(err);
			typesResult = result;
			done();
		});
	});

	it('can parse subarrays', function()
	{
		typesResult.should.be.an('array');
		typesResult.length.should.equal(2);
	});

	it('can parse single-item subarrays', function(done)
	{
    	var blortdata = helpers.readFixture('single-item.xml');
		rparser.parseXML(blortdata, function(err, result)
		{
			should.not.exist(err);
			result.should.be.an('array');
			result.length.should.equal(1);
			result[0].should.be.an('object');
			result[0].should.have.property('name');
			result[0].name.should.equal('The Only Blort');
			done();
		});
	});

	it('can parse boolean types', function()
	{
		var item = typesResult[0];
		item.boolean_value.should.be.a('boolean');
		item.boolean_value.should.equal(false);
	});

	it('can parse integer types', function()
	{
		var item = typesResult[1];
		item.integer_value.should.be.a('number');
		item.integer_value.should.equal(3);
	});

	it('can parse nil types', function()
	{
		var item = typesResult[0];
		item.should.have.property('nil_value');
		item.nil_value.should.equal('');
	});

	it('can parse datetype types', function()
	{
		var item = typesResult[0];
		item.datetime_value.should.be.a('date');
		item.datetime_value.toString().should.equal('Tue Apr 19 2011 00:00:00 GMT-0700 (PDT)');
	});

	it('can parse subobjects', function()
	{
		var item = typesResult[1];

		item.hash_value.should.be.an('object');
		item.hash_value.should.have.property('one');
		item.hash_value.should.have.property('two');
		item.hash_value.one.should.equal(1000);
	});

	it('can parse sample plan xml', function(done)
	{
        var data = helpers.readFixture('plans.xml');
        rparser.parseXML(data, function(err, result)
        {
            should.not.exist(err);
            result.should.be.an('array');
            result.should.be.an('array');
            result.length.should.equal(4);
            done();
        });
	});

	it('can parse sample subscription xml', function(done)
	{
        var data = helpers.readFixture('subscription.xml');
        rparser.parseXML(data, function(err, result)
        {
            should.not.exist(err);
            result.should.be.an('array');
            result.length.should.equal(1);
            var subscription = result[0];
            subscription.should.have.property('uuid');
            subscription.uuid.should.equal('44f83d7cba354d5b84812419f923ea96');
            done();
        });
	});

	it('can parse sample transaction xml', function(done)
	{
        var data = helpers.readFixture('transactions.xml');
        rparser.parseXML(data, function(err, result)
        {
            should.not.exist(err);
            result.should.be.an('array');
            result.length.should.equal(1);
            var transaction = result[0];
            transaction.should.have.property('uuid');
            transaction.uuid.should.equal('a13acd8fe4294916b79aec87b7ea441f');
            done();
        });
	});
});
