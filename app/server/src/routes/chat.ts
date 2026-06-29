import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import OpenAI from 'openai'
import path from 'path'
import { assembleSystemPrompt } from '../lib/prompt-assembler'
import {
  PROFILES_DIR,
  getOpenAIConfig,
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

app.post('/', async (c) => {
  const { profileId, messages } = await c.req.json<ChatRequest>()

  if (!profileId || !messages?.length) {
    return c.json({ error: 'profileId and messages are required' }, 400)
  }

  const profileDir = path.join(PROFILES_DIR, profileId)
  const userQuery = messages.filter(m => m.role === 'user').pop()?.content ?? ''

  let systemPrompt: string
  try {
    systemPrompt = await assembleSystemPrompt(profileDir, userQuery)
  } catch {
    return c.json({ error: 'Profile not found or could not be loaded' }, 404)
  }

  return streamSSE(c, async (stream) => {
    try {
      const { apiKey, baseURL, modelName } = getOpenAIConfig()
      const client = new OpenAI({
        apiKey,
        baseURL,
      })

      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: RESPONSE_FORMAT_GUARD },
        ...messages.map(m => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
      ]

      const response = await client.chat.completions.create({
        model: modelName,
        max_tokens: 2048,
        messages: openaiMessages,
        stream: true,
      })

      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content
        if (text) await stream.writeSSE({ data: text })
      }
    } catch (err) {
      await stream.writeSSE({ data: '[ERROR]' })
    } finally {
      await stream.writeSSE({ data: '[DONE]' })
    }
  })
})

export default app
