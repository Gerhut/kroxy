'use strict'

const http = require('http')
const https = require('https')
const url = require('url')
const debug = require('debug')('kroxy')
const getRawBody = require('raw-body')
const inflate = require('inflation')

const withoutHopByHopHeaders = headers => {
  const HOP_BY_HOP_HEADERS = [
    'connection',
    'keep-alive',
    'public',
    'proxy-authenticate',
    'transfer-encoding',
    'upgrade'
  ]
  const result = Object.create(null)

  for (let key in headers) {
    key = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.indexOf(key) === -1) {
      result[key] = headers[key]
    }
  }
  return result
}

const request = (options, setBody) => new Promise((resolve, reject) => {
  const createRequest = options.protocol === 'https:'
    ? https.request
    : http.request
  const req = createRequest(options)
  req.once('response', resolve)
  req.once('error', reject)
  setBody(req)
})

module.exports = options => {
  options = options || {}
  const trustRequestBody = !!options.trustRequestBody
  const parseResponseBody = !!options.parseResponseBody

  return function * (next) {
    if (!this.request.url.match(/^https?:\/\//)) return yield next

    // eslint-disable-next-line node/no-deprecated-api
    const options = url.parse(this.request.url)
    options.method = this.request.method
    options.headers = withoutHopByHopHeaders(this.request.headers)

    const res = yield ((options, body) => {
      if (trustRequestBody && typeof body !== 'undefined') {
        delete options.headers['content-length']
        if (body === null) {
          delete options.headers['content-type']
          return request(options, req => req.end())
        }

        if (typeof body === 'string') {
          if (!('content-type' in options.headers)) {
            options.headers['content-type'] = 'text/plain;charset=utf-8'
          }
          return request(options, req => req.end(body, 'utf8'))
        }

        if (Buffer.isBuffer(body)) {
          return request(options, req => req.end(body))
        }

        if (typeof body.pipe === 'function') {
          return request(options, req => body.pipe(req))
        }

        if (!('content-type' in options.headers)) {
          options.headers['content-type'] = 'application/json;charset=utf-8'
        }
        return request(options, req => req.end(JSON.stringify(body), 'utf8'))
      } else {
        return request(options, req => this.req.pipe(req))
      }
    })(options, this.request.body)

    debug(`${options.method} ${this.request.url}`, `${res.statusCode} ${res.statusMessage}`)

    this.response.status = res.statusCode
    this.response.message = res.statusMessage
    for (const key in withoutHopByHopHeaders(res.headers)) {
      this.response.set(key, res.headers[key])
    }
    if (parseResponseBody) {
      this.response.remove('content-encoding')
      this.response.body = yield getRawBody(inflate(res))
    } else {
      this.response.body = res
    }
  }
}
