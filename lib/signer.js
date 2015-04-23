// https://docs.recurly.com/api/recurlyjs/signatures

var
	crypto = require('crypto'),
	qs = require('qs'),
	uuid = require('node-uuid')
	;

function SignedQuery(key)
{
	this.params = {};
	this.key = key;
}

SignedQuery.prototype.serialize = function()
{
	if (!this.qs)
	{
		if (!this.params.nonce)
			this.params.nonce = uuid.v4();
		if (!this.params.timestamp)
			this.params.timestamp = Math.ceil(Date.now() / 1000);

		// alphabetize keys
		var tmp = {};
		var keys = Object.keys(this.params).sort();
		for (var i = 0; i < keys.length; i++)
			tmp[keys[i]] = this.params[keys[i]];
		this.params = tmp;

		this.qs = decodeURI(qs.stringify(this.params));
	}

	return this.qs;
};

SignedQuery.prototype.set = function(key, value)
{
	this.qs = null;

	if ((typeof key === 'object') && !value)
		this.params = key;
	else
		this.params[key] = value;
};

SignedQuery.prototype.HMAC = function(data)
{
	var hmac = crypto.createHmac('sha1', this.key);
	hmac.update(data);
	return hmac.digest('hex');
};

SignedQuery.prototype.toString = function()
{
	var query = encodeURI(this.serialize());
	return this.HMAC(query) + '|' + query;
};

exports.SignedQuery = SignedQuery;
