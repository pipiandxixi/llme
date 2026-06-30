import OpenAI from 'openai'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai/error'
import path from 'path'
import { PROFILES_DIR, getOpenAIConfig, getOpenAIEnvStatus } from '../app/server/src/config'
import { assembleSystemPrompt } from '../app/server/src/lib/prompt-assembler'
import { runChat as runSharedChat } from '../app/server/src/lib/chat-runner'
import type { ChatRequest } from '../app/server/src/types'

export { getOpenAIEnvStatus }

export const UPSTREAM_TIMEOUT_MS = 15000

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function sendJson(res: {
  status: (code: number) => { json: (payload: unknown) => unknown }
}, data: unknown, status = 200) {
  return res.status(status).json(data)
}

export function formatUpstreamError(err: unknown): string {
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

export function serializeError(err: unknown) {
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

export async function runFullChat(profileId: string, query: string, maxTokens = 128) {
  const startedAt = Date.now()
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
    max_tokens: maxTokens,
    temperature: 0,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: 'You must reply with OK only.' },
      { role: 'user', content: query },
    ],
  })

  return {
    durationMs: Date.now() - startedAt,
    promptAssembleMs: promptReadyAt - promptStartedAt,
    promptLength: systemPrompt.length,
    ...getOpenAIEnvStatus(),
    modelName,
    baseURL,
    replyPreview: response.choices[0]?.message?.content?.slice(0, 80) ?? '',
  }
}

export async function runChat(body: ChatRequest) {
  return runSharedChat(body, {
    timeout: UPSTREAM_TIMEOUT_MS,
    maxRetries: 0,
  })
}
