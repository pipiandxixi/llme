import { json } from '../_helpers'

export default async function handler(req: Request) {
  const startedAt = Date.now()
  const body = await req.json()
  return json({
    ok: true,
    durationMs: Date.now() - startedAt,
    body,
    contentType: req.headers.get('content-type'),
  })
}
