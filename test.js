const stream = require('stream')
const test = require('ava')
const koa = require('koa')
const axios = require('axios')
const tunnelAgent = require('tunnel-agent')
const kroxy = require('.')

const generalKroxyApp = (() => {
  const app = koa()
  app.use(kroxy())
  return app
})()

const axiosServer = ({ context }, app = generalKroxyApp) =>
  new Promise(resolve => {
    const server = app.listen(() => resolve(axios.create({
      baseURL: 'http://httpbin.org/',
      proxy: {
        host: '127.0.0.1',
        port: server.address().port
      }
    })))
    server.on('connect', kroxy.tunnel())
    context.server = server
  })

test.afterEach(({context: { server }}) => server && server.close())

test('Method', t => axiosServer(t)
  .then(axios => axios.patch('/patch'))
  .then(response => t.is(response.status, 200)))

test('Query String', t => axiosServer(t)
  .then(axios => axios.get('/get', { params: { foo: 'bar' } })
    .then(response => t.is(response.data.args.foo, 'bar'))))

test('Request Header', t => axiosServer(t)
  .then(axios => axios.get('/headers', { headers: { 'x-foo': 'bar' } })
    .then(response => t.is(response.data.headers['X-Foo'], 'bar'))))

test('Request Body', t => axiosServer(t)
  .then(axios => axios.post('/post', { foo: 'bar' }))
  .then(response => t.is(response.data.json.foo, 'bar')))

test('Status Code', t => axiosServer(t)
  .then(axios => axios.get('/status/418'))
  .catch(error => t.is(error.response.status, 418)))

test('Response Header', t => axiosServer(t)
  .then(axios => axios.get('/response-headers', {params: { 'x-foo': 'bar' }}))
  .then(response => t.is(response.headers['x-foo'], 'bar')))

test('general http request', t => {
  const app = koa()
  app.use(kroxy())
  app.use(function * () { this.body = 'foo' })
  return axiosServer(t, app)
    .then(axios => {
      const port = t.context.server.address().port
      return axios.get(`http://localhost:${port}/`)
    })
    .then((response) => t.is(response.data, 'foo'))
})

test('http tunnel', t => axiosServer(t)
  .then(() => axios.get('https://httpbin.org/', {
    httpsAgent: tunnelAgent.httpsOverHttp({
      proxy: {
        host: '127.0.0.1',
        port: t.context.server.address().port
      }
    })
  }).then(() => t.pass())))

test('with untrusted request body', t => {
  const app = koa()
  app.use(function * (next) {
    delete this.request.headers['content-type']
    this.request.body = 'foo'
    yield next
  })
  app.use(kroxy())
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.not(response.data.data, 'foo')))
})

test('with request body (null)', t => {
  const app = koa()
  app.use(function * (next) {
    this.request.body = null
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.false('bar' in response.data.form)))
})

test('with request body (string)', t => {
  const app = koa()
  app.use(function * (next) {
    delete this.request.headers['content-type']
    this.request.body = 'foo'
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => {
        t.is(response.data.headers['Content-Type'], 'text/plain;charset=utf-8')
        t.is(response.data.data, 'foo')
      }))
})

test('with request body (string), keep content type', t => {
  const app = koa()
  app.use(function * (next) {
    this.request.body = 'bar=2'
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => {
        t.is(response.data.form.bar, '2')
      }))
})

test('with request body (buffer)', t => {
  const app = koa()
  app.use(function * (next) {
    this.request.body = Buffer.from('bar=3', 'utf-8')
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.form.bar, '3')))
})

test('with request body (stream)', t => {
  const app = koa()
  app.use(function * (next) {
    this.request.body = new stream.PassThrough()
    this.request.body.end('bar=4', 'utf-8')
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.form.bar, '4')))
})

test('with request body (JSON)', t => {
  const app = koa()
  app.use(function * (next) {
    delete this.request.headers['content-type']
    this.request.body = { bar: 5 }
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.json.bar, 5)))
})

test('with request body (JSON), keep content type', t => {
  const app = koa()
  app.use(function * (next) {
    this.request.body = { bar: '=5' } // {"bar":"=5"}
    yield next
  })
  app.use(kroxy({ trustRequestBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.form['{"bar":"'], '5"}')))
})

test('do not parse response body', t => {
  const app = koa()
  app.use(function * (next) {
    yield next
    t.is(typeof this.response.body.pipe, 'function')
  })
  app.use(kroxy())
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.form.bar, '1')))
})

test('parse and modify response body', t => {
  const app = koa()
  app.use(function * (next) {
    yield next
    this.response.body = JSON.parse(this.response.body.toString('utf-8'))
    t.is(this.response.body.form.bar, '1')
    this.response.body.form.bar = '2'
  })
  app.use(kroxy({ parseResponseBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.post('/post', 'bar=1')
      .then(response => t.is(response.data.form.bar, '2')))
})

test('parse gzipped response body', t => {
  const app = koa()
  app.use(function * (next) {
    yield next
    this.response.body = JSON.parse(this.response.body.toString('utf-8'))
    t.falsy(this.response.get('content-encoding'),
      'Remove Content-Encoding header')
    t.true(this.response.body.gzipped)
  })
  app.use(kroxy({ parseResponseBody: true }))
  return axiosServer(t, app)
    .then(axios => axios.get('/gzip'))
})
