const net = require('net')
const axios = require('axios')
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

exports = module.exports = () => function * (next) {
  if (this.request.url.slice(0, 4) !== 'http') return yield next

  const response = yield axios.request({
    url: this.request.url,
    method: this.request.method,
    headers: cleanHeaders(this.request.headers),
    data: this.request.body || this.req,
    responseType: 'stream',
    maxContentLength: -1,
    validateStatus: status => true,
    maxRedirects: 0
  })

  debug(`${response.config.method} ${response.config.url}`, `${response.status} ${response.statusText}`)

  this.response.status = response.status
  this.response.message = response.statusText
  for (let header in cleanHeaders(response.headers)) {
    this.response.set(header, response.headers[header])
  }
  this.response.body = response.data
}

exports.connect = () => (request, source, head) => {
  debug(`CONNECT ${request.url}`)

  function cleanup (error) {
    if (error instanceof Error) {
      debug('ERROR', error)
    }
    debug(`DISCONNECT ${request.url}`)
    if (source) {
      source.destroyed || source.destroy()
      source.removeAllListeners()
      source = null
    }
    if (target) {
      target.destroyed || target.destroy()
      target.removeAllListeners()
      target = null
    }
  }

  const [ hostname, port = 80 ] = request.url.split(':')

  let target = net.connect(port, hostname, () => {
    source.write(`HTTP/${request.httpVersion} 200 Connection Established\r\n\r\n`)
    target.write(head)
    source.pipe(target)
    target.pipe(source)
  })
  source.on('close', cleanup)
  source.on('end', cleanup)
  source.on('error', cleanup)
  target.on('close', cleanup)
  target.on('end', cleanup)
  target.on('error', cleanup)
}
