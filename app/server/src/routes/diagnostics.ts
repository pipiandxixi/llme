import { Hono } from 'hono'
import OpenAI from 'openai'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai/error'
import path from 'path'
import { assembleSystemPrompt } from '../lib/prompt-assembler'
import { getOpenAIConfig, getOpenAIEnvStatus } from '../config'
import { PROFILES_DIR } from '../config'

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

function serializeError(err: unknown) {
  if (err instanceof APIError) {
    return {
      name: err.name,
      message: err.message,
      status: err.status ?? null,
      code: 'code' in err ? (err as { code?: unknown }).code ?? null : null,
      type: 'type' in err ? (err as { type?: unknown }).type ?? null : null,
      stack: err.stack ?? null,
    }
  }

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack ?? null,
      cause: 'cause' in err ? String((err as { cause?: unknown }).cause ?? '') : null,
    }
  }

  return { value: String(err) }
}

app.get('/env', (c) => c.json(getOpenAIEnvStatus()))

app.get('/upstream', async (c) => {
  const startedAt = Date.now()
  console.log('[diagnostics] upstream:start', JSON.stringify(getOpenAIEnvStatus()))

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
      ...getOpenAIEnvStatus(),
      modelName,
      baseURL,
      replyPreview: response.choices[0]?.message?.content?.slice(0, 80) ?? '',
    })
  } catch (err) {
    console.error('[diagnostics] upstream:failed', JSON.stringify({
      ...getOpenAIEnvStatus(),
      durationMs: Date.now() - startedAt,
      error: formatUpstreamError(err),
      details: serializeError(err),
    }))
    return c.json({
      ok: false,
      durationMs: Date.now() - startedAt,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
    }, 502)
  }
})

app.get('/full-chat', async (c) => {
  const startedAt = Date.now()
  const profileId = c.req.query('profileId') || 'elonmusk'
  const query = c.req.query('q') || '介绍一下你自己'

  try {
    const profileDir = path.join(PROFILES_DIR, profileId)
    const promptStartedAt = Date.now()
    const systemPrompt = await assembleSystemPrompt(profileDir, query)
    const promptReadyAt = Date.now()

    const { apiKey, baseURL, modelName } = getOpenAIConfig()
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 0,
    })

    const response = await client.chat.completions.create({
      model: modelName,
      max_tokens: 128,
      temperature: 0,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: 'You must reply with OK only.' },
        { role: 'user', content: query },
      ],
    })

    return c.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      promptAssembleMs: promptReadyAt - promptStartedAt,
      promptLength: systemPrompt.length,
      ...getOpenAIEnvStatus(),
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
      details: serializeError(err),
    }, 502)
  }
})

export default app
