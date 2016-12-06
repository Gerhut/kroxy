'use strict'

const net = require('net')
const debug = require('debug')('kroxy:tunnel')

module.exports = () => (request, source, head) => {
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

  const urlParts = request.url.split(':')
  const hostname = urlParts[0]
  const port = +urlParts[1]

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
