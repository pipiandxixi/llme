import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import OpenAI from 'openai'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai/error'
import path from 'path'
import { assembleSystemPrompt } from '../lib/prompt-assembler'
import {
  PROFILES_DIR,
  getOpenAIConfig,
  getOpenAIEnvStatus,
} from '../config'
import type { ChatRequest } from '../types'

const app = new Hono()

const RESPONSE_FORMAT_GUARD = `
你必须只输出一个合法 JSON 对象，不要输出 Markdown，不要输出代码块，不要输出额外解释。

JSON 结构如下：
{
  "intro": "开场核心判断，1到3句话",
  "sections": [
    {
      "title": "小标题",
      "bullets": ["要点1", "要点2"],
      "paragraphs": ["补充说明1", "补充说明2"]
    }
  ],
  "conclusion": "简短结论",
  "followUp": "仅在确实有帮助时填写一个追问，否则输出空字符串"
}

硬性要求：
- 始终输出合法 JSON
- 所有字段都必须存在
- 没有内容时使用空字符串或空数组
- 复杂回答优先写进 sections
- bullets 里的每一项必须是单独一句完整的话
- 不要在 JSON 前后添加任何其他字符
`.trim()

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

app.post('/', async (c) => {
  const { profileId, messages } = await c.req.json<ChatRequest>()
  const requestMeta = {
    profileId,
    messageCount: messages?.length ?? 0,
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

  return streamSSE(c, async (stream) => {
    const startedAt = Date.now()
    try {
      const { apiKey, baseURL, modelName } = getOpenAIConfig()
      const client = new OpenAI({
        apiKey,
        baseURL,
        timeout: UPSTREAM_TIMEOUT_MS,
        maxRetries: 0,
      })

      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: RESPONSE_FORMAT_GUARD },
        ...messages.map(m => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
      ]

      console.log('[chat] start', JSON.stringify({
        ...requestMeta,
        modelName,
        baseURL,
        env: getOpenAIEnvStatus(),
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      }))

      const upstreamStartedAt = Date.now()
      const response = await client.chat.completions.create({
        model: modelName,
        max_tokens: 2048,
        messages: openaiMessages,
        stream: false,
      })

      const content = response.choices[0]?.message?.content ?? ''
      const firstChunkAt = Date.now()

      console.log('[chat] first_chunk', JSON.stringify({
        ...requestMeta,
        durationMs: firstChunkAt - upstreamStartedAt,
        chunkCount: content ? 1 : 0,
      }))

      if (content) {
        await stream.writeSSE({ data: content })
      }

      console.log('[chat] complete', JSON.stringify({
        ...requestMeta,
        durationMs: Date.now() - startedAt,
        upstreamDurationMs: Date.now() - upstreamStartedAt,
        firstChunkLatencyMs: firstChunkAt ? firstChunkAt - upstreamStartedAt : null,
        chunkCount: content ? 1 : 0,
        contentLength: content.length,
      }))
    } catch (err) {
      const errorMessage = formatUpstreamError(err)
      console.error('[chat] failed', JSON.stringify({
        ...requestMeta,
        durationMs: Date.now() - startedAt,
        error: errorMessage,
        details: serializeError(err),
        env: getOpenAIEnvStatus(),
      }))
      await stream.writeSSE({ data: `系统错误：${errorMessage}` })
      await stream.writeSSE({ data: '[ERROR]' })
    } finally {
      await stream.writeSSE({ data: '[DONE]' })
    }
  })
})

export default app
