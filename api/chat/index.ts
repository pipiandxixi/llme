import type { ChatRequest } from '../../app/server/src/types'
import { formatUpstreamError, getOpenAIEnvStatus, runChat, sendJson, serializeError } from '../_helpers'

export default async function handler(req: any, res: any) {
  const startedAt = Date.now()

  try {
    const body = req.body as ChatRequest
    const requestMeta = {
      profileId: body.profileId,
      messageCount: body.messages?.length ?? 0,
      userAgent: req.headers['user-agent'] ?? null,
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

    return sendJson(res, { content: result.content })
  } catch (err) {
    console.error('[chat-native] failed', JSON.stringify({
      durationMs: Date.now() - startedAt,
      error: formatUpstreamError(err),
      details: serializeError(err),
      env: getOpenAIEnvStatus(),
    }))
    return sendJson(res, { error: formatUpstreamError(err) }, 502)
  }
}
