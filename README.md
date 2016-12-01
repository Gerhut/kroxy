# kroxy
HTTP proxy middleware of Koa.

[![Build Status](https://travis-ci.org/Gerhut/kroxy.svg?branch=master)](https://travis-ci.org/Gerhut/kroxy)
[![Coverage Status](https://coveralls.io/repos/github/Gerhut/kroxy/badge.svg?branch=master)](https://coveralls.io/github/Gerhut/kroxy?branch=master)
[![dependencies Status](https://david-dm.org/Gerhut/kroxy/status.svg)](https://david-dm.org/Gerhut/kroxy)
[![devDependencies Status](https://david-dm.org/Gerhut/kroxy/dev-status.svg)](https://david-dm.org/Gerhut/kroxy?type=dev)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

## Install

    $ npm install --save kroxy

## Usage
```javascript
const http = require('http')

const koa = require('koa')
const kroxy = require('kroxy')

const app = koa()
app.use(kroxy()) // HTTP forward proxy

const server = http.createServer()
server.on('request', app.callback())
server.on('connect', kroxy.connect()) // HTTP tunnel proxy
```

## License

MIT
