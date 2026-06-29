import type { ChatRequest } from '../../app/server/src/types'
import { formatUpstreamError, getOpenAIEnvStatus, json, runChat, serializeError } from '../_helpers'

export default async function handler(req: Request) {
  const startedAt = Date.now()

  try {
    const body = await req.json() as ChatRequest
    const requestMeta = {
      profileId: body.profileId,
      messageCount: body.messages?.length ?? 0,
      userAgent: req.headers.get('user-agent'),
    }

    console.log('[chat-native] start', JSON.stringify({
      ...requestMeta,
      env: getOpenAIEnvStatus(),
    }))

    const result = await runChat(body)

    console.log('[chat-native] complete', JSON.stringify({
      ...requestMeta,
      durationMs: Date.now() - startedAt,
      contentLength: result.content.length,
      modelName: result.modelName,
      baseURL: result.baseURL,
    }))

    return json({ content: result.content })
  } catch (err) {
    console.error('[chat-native] failed', JSON.stringify({
      durationMs: Date.now() - startedAt,
      error: formatUpstreamError(err),
      details: serializeError(err),
      env: getOpenAIEnvStatus(),
    }))
    return json({ error: formatUpstreamError(err) }, 502)
  }
}
