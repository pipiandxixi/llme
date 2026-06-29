import { Hono } from 'hono'
import OpenAI from 'openai'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai/error'
import { getOpenAIConfig, getOpenAIEnvStatus } from '../config'

const app = new Hono()
const UPSTREAM_TIMEOUT_MS = 15000

function formatUpstreamError(err: unknown): string {
  if (err instanceof APIConnectionTimeoutError) {
    return `upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
  }
  if (err instanceof APIConnectionError) {
    return `upstream connection error: ${err.message}`
  }
  if (err instanceof APIError) {
    return `upstream api error ${err.status ?? 'unknown'}: ${err.message}`
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'unknown upstream error'
}

app.get('/env', (c) => c.json(getOpenAIEnvStatus()))

app.get('/upstream', async (c) => {
  const startedAt = Date.now()

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

    return c.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      modelName,
      baseURL,
      replyPreview: response.choices[0]?.message?.content?.slice(0, 80) ?? '',
    })
  } catch (err) {
    return c.json({
      ok: false,
      durationMs: Date.now() - startedAt,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
    }, 502)
  }
})

export default app
