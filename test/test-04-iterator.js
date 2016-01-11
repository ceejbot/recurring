/*global describe:true, it:true, before:true, after:true */

var
	demand    = require('must'),
	parser    = require('../lib/parser'),
	recurly   = require('../lib/recurly')(),
	util      = require('util'),
	uuid      = require('node-uuid'),
  iterators = require('async-iterators'),
  _         = require('lodash')
	;

// This recurly account is an empty test account connected to their
// development gateway.
var config =
{
	apikey: '88ac57c6891440bda9ba28b6b9c18857',
	subdomain: 'recurring-test'
};

before(function()
{
	recurly.setAPIKey(config.apikey);
});

describe('Iterator', function()
{
	it('Can loop through items in an iterator', function(done)
	{
		this.timeout(30000);
		var iterator = recurly.Transaction.iterator();
		iterator.must.be.an.object();
		iterators.forEachAsync(iterator, function(err, transaction, cb)
		{
			transaction.must.have.an.id;
			cb();
		}, done);
	});
});
