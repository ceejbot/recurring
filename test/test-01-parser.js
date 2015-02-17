/*global describe:true, it:true, before:true, after:true */

var
	demand = require('must'),
	fs     = require('fs'),
	parser = require('../lib/parser'),
	path   = require('path'),
	util   = require('util')
	;

// ----------------------------------------------------------------------

var testdir = __dirname;
if (path.basename(testdir) !== 'test')
	testdir = path.join(testdir, 'test');

function readFixture(fixture)
{
	var fpath = path.join(testdir, 'fixtures', fixture);
	var data = fs.readFileSync(fpath, 'utf8');
	return data;
}

// ----------------------------------------------------------------------

var rparser;

before(function()
{
	rparser = parser.createParser();
});


describe('recurly xml parser', function()
{
	var data = readFixture('types.xml');
	var typesResult;

	it('can parse basic data types', function(done)
	{
		rparser.parseXML(data, function(err, result)
		{
			demand(err).not.exist();
			typesResult = result;
			done();
		});
	});

	it('can parse subarrays', function()
	{
		typesResult.must.be.an.array();
		typesResult.length.must.equal(2);
	});

	it('can parse single-item subarrays', function(done)
	{
    	var blortdata = readFixture('single-item.xml');
		rparser.parseXML(blortdata, function(err, result)
		{
			demand(err).not.exist();
			result.must.be.an.array();
			result.length.must.equal(1);
			result[0].must.be.an.object();
			result[0].must.have.property('name');
			result[0].name.must.equal('The Only Blort');
			done();
		});
	});

	it('can parse boolean types', function()
	{
		var item = typesResult[0];
		item.boolean_true.must.be.a.boolean();
		item.boolean_true.must.equal(true);
		item.boolean_false.must.be.a.boolean();
		item.boolean_false.must.equal(false);
	});

	it('can parse integer types', function()
	{
		var item = typesResult[1];
		item.integer_value.must.be.a.number();
		item.integer_value.must.equal(3);
	});

	it('can parse nil types', function()
	{
		var item = typesResult[0];
		item.must.have.property('nil_value');
		item.nil_value.must.equal('');
	});

	it('can parse datetype types', function()
	{
		var item = typesResult[0];
		item.datetime_value.must.be.a.date();
		var comparisonDate = new Date('Tue Apr 19 2011 00:00:00 GMT-0700 (PDT)');
		item.datetime_value.getTime().must.equal(comparisonDate.getTime());
	});

	it('can parse subobjects', function()
	{
		var item = typesResult[1];

		item.hash_value.must.be.an.object();
		item.hash_value.must.have.property('one');
		item.hash_value.must.have.property('two');
		item.hash_value.one.must.equal(1000);
	});

	it('can parse sample plan xml', function(done)
	{
        var data = readFixture('plans.xml');
        rparser.parseXML(data, function(err, result)
        {
            demand(err).not.exist();
            result.must.be.an.array();
            result.must.be.an.array();
            result.length.must.equal(4);
            done();
        });
	});

	it('can parse sample subscription xml', function(done)
	{
        var data = readFixture('subscription.xml');
        rparser.parseXML(data, function(err, result)
        {
            demand(err).not.exist();
            result.must.be.an.array();
            result.length.must.equal(1);
            var subscription = result[0];
            subscription.must.have.property('uuid');
            subscription.uuid.must.equal('44f83d7cba354d5b84812419f923ea96');
            done();
        });
	});

	it('can parse sample transaction xml', function(done)
	{
        var data = readFixture('transactions.xml');
        rparser.parseXML(data, function(err, result)
        {
            demand(err).not.exist();
            result.must.be.an.array();
            result.length.must.equal(1);
            var transaction = result[0];
            transaction.must.have.property('uuid');
            transaction.uuid.must.equal('a13acd8fe4294916b79aec87b7ea441f');
            done();
        });
	});

	it('can parse sample billing info xml', function(done)
	{
	    var data = readFixture('billing_info_cc.xml');
	    rparser.parseXML(data, function(err, result)
	    {
            demand(err).not.exist();
            result.must.not.be.an.array();
            result.must.have.property('href');
            result.must.have.property('type');
            done();
	    });
	});
});
