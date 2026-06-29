import OpenAI from 'openai'
import { getOpenAIConfig, getOpenAIEnvStatus } from '../../app/server/src/config'
import { formatUpstreamError, json, serializeError, UPSTREAM_TIMEOUT_MS } from '../_helpers'

export default async function handler() {
  const startedAt = Date.now()
  console.log('[diagnostics-native] upstream:start', JSON.stringify(getOpenAIEnvStatus()))

  try {
    const { apiKey, baseURL, modelName } = getOpenAIConfig()
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 0,
    })

    const response = await client.chat.completions.create({
      model: modelName,
      max_tokens: 32,
      temperature: 0,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
      stream: false,
    })

    return json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...getOpenAIEnvStatus(),
      modelName,
      baseURL,
      replyPreview: response.choices[0]?.message?.content?.slice(0, 80) ?? '',
    })
  } catch (err) {
    console.error('[diagnostics-native] upstream:failed', JSON.stringify({
      ...getOpenAIEnvStatus(),
      durationMs: Date.now() - startedAt,
      error: formatUpstreamError(err),
      details: serializeError(err),
    }))
    return json({
      ok: false,
      durationMs: Date.now() - startedAt,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
      details: serializeError(err),
    }, 502)
  }
}
