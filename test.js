import test from 'ava'
import koa from 'koa'
import axios from 'axios'
import tunnelAgent from 'tunnel-agent'
import kroxy from '.'

const proxyAddress = {
  host: '127.0.0.1',
  port: 8888
}

test.before(t => new Promise(resolve => {
  const app = koa()
  app.use(kroxy())
  app.use(function * () { this.body = 'foo' })
  const server = app.listen(proxyAddress, resolve)
  server.on('connect', kroxy.connect)
}))

test.beforeEach(t => {
  t.context = axios.create({
    baseURL: 'http://httpbin.org/',
    proxy: proxyAddress
  })
})

test('Method', t => t.context.patch('/patch')
  .then(response => t.is(response.status, 200)))

test('Query String', t => t.context.get('/get', {
  params: { foo: 'bar' }
}).then(response => t.is(response.data.args.foo, 'bar')))

test('Request Header', t => t.context.get('/headers', {
  headers: { 'x-foo': 'bar' }
}).then(response => t.is(response.data.headers['X-Foo'], 'bar')))

test('Request Body', t => t.context.post('/post', {
  foo: 'bar'
}).then(response => t.is(response.data.json.foo, 'bar')))

test('Status Code', t => t.context.get('/status/418')
  .catch(error => t.is(error.response.status, 418)))

test('Response Header', t => t.context.get('/response-headers', {
  params: { 'x-foo': 'bar' }
}).then(response => t.is(response.headers['x-foo'], 'bar')))

test('general http request', t => axios.get('http://localhost:8888/')
  .then((response) => t.is(response.data, 'foo')))

test('http tunnel', t => axios.get('https://httpbin.org/', {
  httpsAgent: tunnelAgent.httpsOverHttp({
    proxy: proxyAddress
  })
}))
