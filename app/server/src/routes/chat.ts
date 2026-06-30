import { Hono } from 'hono'
import path from 'path'
import { assembleSystemPrompt } from '../lib/prompt-assembler'
import {
  PROFILES_DIR,
  getOpenAIEnvStatus,
} from '../config'
import { runChat as runSharedChat } from '../lib/chat-runner'
import type { ChatRequest } from '../types'

const app = new Hono()

const UPSTREAM_TIMEOUT_MS = 15000

function formatUpstreamError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return 'unknown upstream error'
}

app.post('/', async (c) => {
  const { profileId, messages, webSearchMode } = await c.req.json<ChatRequest>()
  const requestMeta = {
    profileId,
    messageCount: messages?.length ?? 0,
    webSearchMode: webSearchMode ?? 'auto',
    vercelId: c.req.header('x-vercel-id') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }

  if (!profileId || !messages?.length) {
    return c.json({ error: 'profileId and messages are required' }, 400)
  }

  const profileDir = path.join(PROFILES_DIR, profileId)
  const userQuery = messages.filter(m => m.role === 'user').pop()?.content ?? ''

  let systemPrompt: string
  try {
    console.log('[chat] prompt:load', JSON.stringify(requestMeta))
    systemPrompt = await assembleSystemPrompt(profileDir, userQuery)
    console.log('[chat] prompt:ready', JSON.stringify({
      ...requestMeta,
      systemPromptLength: systemPrompt.length,
      userQueryLength: userQuery.length,
    }))
  } catch {
    return c.json({ error: 'Profile not found or could not be loaded' }, 404)
  }
  const startedAt = Date.now()
  try {
    console.log('[chat] start', JSON.stringify({
      ...requestMeta,
      env: getOpenAIEnvStatus(),
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    }))

    const upstreamStartedAt = Date.now()
    const result = await runSharedChat({
      profileId,
      messages,
      webSearchMode,
    }, {
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 0,
    })

    const firstChunkAt = Date.now()

    console.log('[chat] first_chunk', JSON.stringify({
      ...requestMeta,
      webSearchEnabled: result.webSearch.enabled,
      webSearchReason: result.webSearch.reason,
      durationMs: firstChunkAt - upstreamStartedAt,
      chunkCount: result.content ? 1 : 0,
    }))

    console.log('[chat] complete', JSON.stringify({
      ...requestMeta,
      modelName: result.modelName,
      baseURL: result.baseURL,
      webSearchEnabled: result.webSearch.enabled,
      webSearchReason: result.webSearch.reason,
      knowledgeHitCount: result.webSearch.knowledgeHitCount,
      knowledgeTopScore: result.webSearch.knowledgeTopScore,
      durationMs: Date.now() - startedAt,
      upstreamDurationMs: Date.now() - upstreamStartedAt,
      firstChunkLatencyMs: firstChunkAt - upstreamStartedAt,
      chunkCount: result.content ? 1 : 0,
      contentLength: result.content.length,
    }))

    return c.json({ content: result.content })
  } catch (err) {
    const errorMessage = formatUpstreamError(err)
    console.error('[chat] failed', JSON.stringify({
      ...requestMeta,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
      env: getOpenAIEnvStatus(),
    }))
    return c.json({ error: errorMessage }, 502)
  }
})

export default app
