'use strict'

const http = require('http')
const https = require('https')
const url = require('url')
const debug = require('debug')('kroxy')

const cleanHeaders = headers => {
  const HOP_BY_HOP_HEADERS = [
    'connection',
    'keep-alive',
    'public',
    'proxy-authenticate',
    'transfer-encoding',
    'upgrade'
  ]
  const CONTENT_RELATED_HEADERS = [
    'content-length'
  ]
  const result = Object.assign(Object.create(null), headers)

  for (let header of HOP_BY_HOP_HEADERS) {
    delete result[header]
  }
  for (let header of CONTENT_RELATED_HEADERS) {
    delete result[header]
  }
  return result
}

module.exports = () => function * (next) {
  if (!this.request.url.match(/^https?:\/\//)) return yield next

  const options = url.parse(this.request.url)
  options.method = this.request.method
  options.headers = cleanHeaders(this.request.headers)

  const createRequest = options.protocol === 'http:'
    ? http.request : https.request
  const request = createRequest(options)

  if (this.request.body != null) {
    if (typeof this.request.body === 'string') {
      request.end(this.request.bod)
    } else if (Buffer.isBuffer(this.request.body)) {
      request.end(this.request.body)
    } else { // JSON
      if (!('content-type' in options.headers)) {
        options.headers['content-type'] = 'application/json'
      }
      request.end(JSON.stringify(this.request.body))
    }
  } else {
    this.req.pipe(request)
  }

  const response = yield (callback) => {
    request.on('error', error => callback(error))
    request.on('response', response => callback(null, response))
  }

  debug(`${options.method} ${this.request.url}`, `${response.statusCode} ${response.statusMessage}`)

  this.response.status = response.statusCode
  this.response.message = response.statusMessage
  for (let header in cleanHeaders(response.headers)) {
    this.response.set(header, response.headers[header])
  }
  this.response.body = response
}
