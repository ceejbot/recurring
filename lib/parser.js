'use strict';

const xml2js = require('xml2js')

function parseTypes(input) {
  let result = { }
  let item,
    key
  const keys = Object.keys(input)
  let mode = 'normal'

  try {
    for (let i = 0; i < keys.length; i++) {
      key = keys[i]
      item = input[key]
      if (mode === 'array') {
        mode = 'normal'

        if (Array.isArray(item)) {
          result = [ ]
          for (let j = 0; j < item.length; j++) {
            result.push(parseTypes(item[j]))
          }
        }
        else {
          result = [ parseTypes(item) ]
        }
      }
      else if (typeof item === 'object') {
        if (item['#'] && item.type && (item.type === 'datetime')) {
          result[key] = new Date(item['#'])
        }
        else if (item['#'] && item.type && (item.type === 'integer')) {
          result[key] = parseInt(item['#'], 10)
        }
        else if (item['#'] && item.type && (item.type === 'boolean')) {
          result[key] = Boolean(item['#'] === 'true')
        }
        else if (item.nil && (item.nil === 'nil')) {
          result[key] = ''
        }
        else {
          result[key] = parseTypes(item)
        }
      }
      else if ((key === 'type') && (item === 'array')) {
        mode = 'array'
      }
      else {
        result[key] = item
      }
    }
  }
  catch (exception) {
    // console.error('recurly.parseTypes: @ ' + key + ' ' + item + '  ' +   JSON.stringify(exception));
    result = input
  }

  return result
}

class RecurlyParser {
  constructor() {
    this.parser = new xml2js.Parser(
      {
        mergeAttrs: true,
        attrkey: '#',
        charkey: '#',
        explicitArray: false,
        explicitRoot: false
      })
  }

  parseXML(input, callback) {
    let calledBack = false

    this.parser.removeAllListeners('error')
    this.parser.on('error', exception => {
      calledBack = true
      callback(exception)
    })

    this.parser.parseString(input, (err, json) => {
      if (calledBack) {
        return
      }
      if (err) {
        return callback(err)
      }

      callback(null, parseTypes(json))
    })
  }
}

function createParser() {
  return new RecurlyParser()
}

exports.createParser = createParser
