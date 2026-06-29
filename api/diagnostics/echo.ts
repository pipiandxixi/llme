import { sendJson } from '../_helpers'

export default async function handler(req: any, res: any) {
  const startedAt = Date.now()
  return sendJson(res, {
    ok: true,
    durationMs: Date.now() - startedAt,
    body: req.body,
    contentType: req.headers['content-type'] ?? null,
  })
}
