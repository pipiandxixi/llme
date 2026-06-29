import { formatUpstreamError, getOpenAIEnvStatus, runFullChat, sendJson, serializeError } from '../_helpers'

export default async function handler(req: any, res: any) {
  const profileId = req.query?.profileId || 'elonmusk'
  const query = req.query?.q || '介绍一下你自己'

  try {
    const result = await runFullChat(profileId, query)
    return sendJson(res, { ok: true, ...result })
  } catch (err) {
    return sendJson(res, {
      ok: false,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
      details: serializeError(err),
    }, 502)
  }
}
