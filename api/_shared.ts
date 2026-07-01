import { Hono } from 'hono'
import type { IncomingMessage, ServerResponse } from 'http'
import app from '../app/server/src/app'

const apiApp = new Hono()
apiApp.route('/api', app)

interface VercelRequest extends IncomingMessage {
  body?: unknown
  rawBody?: Buffer
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// @hono/node-server's Vercel adapter builds a Web Request by wrapping the raw
// incoming Node stream. On this project's Vercel runtime that stream has
// already been drained (Vercel pre-parses the body into req.body before our
// handler runs), so the adapter's fallback read just hangs forever with no
// error — every PUT/POST admin request sat until Vercel's own 60s function
// timeout killed it. Bypassing that adapter: build the Request ourselves from
// whichever body source Vercel actually gives us, then call Hono's own
// standard app.fetch() directly.
export default async function handler(req: VercelRequest, res: ServerResponse) {
  const method = req.method ?? 'GET'
  const host = req.headers.host ?? 'localhost'
  const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  const url = `${protocol}://${host}${req.url ?? '/'}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    if (req.rawBody instanceof Buffer) {
      body = new Uint8Array(req.rawBody)
    } else if (req.body !== undefined) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    } else {
      body = new Uint8Array(await readRawBody(req))
    }
  }

  const request = new Request(url, { method, headers, body })
  const response = await apiApp.fetch(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}
