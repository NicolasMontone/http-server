const net = require('net')
const fs = require('fs')
const url = require('url')

const CRLF = '\r\n'
const HTTP_OK = 'HTTP/1.1 200 OK'
const HTTP_CREATED = 'HTTP/1.1 201 Created'
const HTTP_BAD_REQUEST = 'HTTP/1.1 400 Bad Request'
const HTTP_NOT_FOUND = 'HTTP/1.1 404 Not Found'
const PORT = 4221
const HOST = 'localhost'

const parseHeaders = (rawHeaders) => {
  return rawHeaders.reduce((headers, header) => {
    const [key, value] = header.split(': ')
    headers[key] = value

    return headers
  }, {})
}

const parseRequest = (data) => {
    const [requestData, body] = data.toString().split(CRLF + CRLF)
  const rawRequest = requestData.toString().split(CRLF)
  const [method, path] = rawRequest[0].split(' ')
  const headers = parseHeaders(rawRequest.slice(1))


  return { method, path, headers, body }
}

const buildTextResponse = (status, body) => {
  return [
    status,
    'Content-Type: text/plain',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join(CRLF)
}

const handleData = (socket) => (data) => {
  if (!Buffer.isBuffer(data)) {
    console.log('Data must be a Buffer')
    socket.write(`${HTTP_BAD_REQUEST}${CRLF}${CRLF}`)
    return socket.end()
  }
  const { method, path, headers, body } = parseRequest(data)
  const { pathname } = url.parse(path, true)

  if (method === 'POST' && path.startsWith('/files/')) {
    const dirIdx = process.argv.indexOf('--directory') + 1
    const fileName = path.split('/files/')[1]
    const dir = process.argv[dirIdx]
    fs.writeFileSync(dir + '/' + fileName, body)
    socket.write(`${HTTP_CREATED}${CRLF}${CRLF}`)
    return socket.end()
  }
  if (pathname === '/') {
    socket.write(`${HTTP_OK}${CRLF}${CRLF}`)
    return socket.end()
  }
  if (pathname.startsWith('/echo/')) {
    const responseBody = pathname.split('/echo/')[1]
    socket.write(buildTextResponse(HTTP_OK, responseBody))
    return socket.end()
  }
  if (pathname.startsWith('/user-agent')) {
    socket.write(buildTextResponse(HTTP_OK, headers['User-Agent']))
    return socket.end()
  }
  if (pathname.startsWith('/files/')) {
    const dirIdx = process.argv.indexOf('--directory') + 1
    const fileName = path.split('/files/')[1]
    const dir = process.argv[dirIdx]
    // figure out the file system
    try {
      const buff = fs.readFileSync(dir + '/' + fileName)
      const contentHeader1 = 'Content-Type: application/octet-stream'
      const contentHeader2 = `Content-Length: ${buff.length}`
      const res = [
        HTTP_OK,
        contentHeader1,
        contentHeader2,
        '',
        buff.toString(),
      ].join(CRLF)
      socket.write(res)
      return socket.end()
    } catch (err) {
      socket.write(`${HTTP_NOT_FOUND}${CRLF}${CRLF}`)
      return socket.end()
    }
  }
  socket.write(`${HTTP_NOT_FOUND}${CRLF}${CRLF}`)
  socket.end()
}

const server = net.createServer((socket) => {
  socket.on('close', () => socket.end())
  socket.on('data', handleData(socket))
})

server.listen(PORT, HOST)
