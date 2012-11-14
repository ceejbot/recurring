// Helpers for test suites.

var
	fs = require('fs'),
	path = require('path')
	;

var testdir = __dirname;
if (path.basename(testdir) !== 'test')
	testdir = path.join(testdir, 'test');

function readFixture(fixture)
{
	var fpath = path.join(testdir, 'fixtures', fixture);
	var data = fs.readFileSync(fpath, 'utf8');
	return data;
}

function readTestConfig()
{
    // The tests require a config file with an API key.
    var fpath = path.join(testdir, 'config.json');
    var data = fs.readFileSync(fpath, 'utf8');
    return JSON.parse(data);
}

exports.readFixture = readFixture;
exports.readTestConfig = readTestConfig;
