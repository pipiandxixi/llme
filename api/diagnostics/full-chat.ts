import { formatUpstreamError, getOpenAIEnvStatus, json, runFullChat, serializeError } from '../_helpers'

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const profileId = url.searchParams.get('profileId') || 'elonmusk'
  const query = url.searchParams.get('q') || '介绍一下你自己'

  try {
    const result = await runFullChat(profileId, query)
    return json({ ok: true, ...result })
  } catch (err) {
    return json({
      ok: false,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
      details: serializeError(err),
    }, 502)
  }
}
