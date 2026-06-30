import OpenAI from 'openai'
import path from 'path'
import { PROFILES_DIR, getOpenAIConfig } from '../config'
import type { ChatRequest, WebSearchMode } from '../types'
import { assembleSystemPrompt } from './prompt-assembler'
import { detectDomains } from './domain-detector'
import { scoreKnowledge } from './knowledge-retriever'

export const RESPONSE_FORMAT_GUARD = `
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

const WEB_SEARCH_TOOL = {
  type: 'openrouter:web_search',
  parameters: {
    engine: 'auto',
    max_results: 5,
    max_total_results: 10,
    search_context_size: 'medium',
  },
}

const FRESHNESS_PATTERNS = [
  /最新/,
  /最近/,
  /今天/,
  /当前/,
  /目前/,
  /刚刚/,
  /近期/,
  /\b(latest|recent|today|current|currently|now|news)\b/i,
]

const EXPLICIT_SEARCH_PATTERNS = [
  /搜一下/,
  /查一下/,
  /查查/,
  /联网/,
  /搜索/,
  /检索/,
  /\b(search|look up|browse|find online|check online)\b/i,
]

const FACTUAL_PATTERNS = [
  /谁/,
  /多少/,
  /何时/,
  /什么时候/,
  /哪里/,
  /是哪家/,
  /价格/,
  /数据/,
  /公告/,
  /发布/,
  /新闻/,
  /\b(price|date|when|where|who|news|update|release)\b/i,
]

const STABLE_REASONING_PATTERNS = [
  /怎么看/,
  /如何看待/,
  /为什么/,
  /怎么想/,
  /风格/,
  /价值观/,
  /思维/,
  /判断/,
  /决策/,
  /\b(think|view|opinion|style|values|decision)\b/i,
]

export interface WebSearchDecision {
  mode: WebSearchMode
  enabled: boolean
  reason: string
  knowledgeTopScore: number
  knowledgeHitCount: number
}

export interface RunChatResult {
  content: string
  modelName: string
  baseURL: string
  webSearch: WebSearchDecision
}

function matchesAny(patterns: RegExp[], query: string): boolean {
  return patterns.some((pattern) => pattern.test(query))
}

async function decideWebSearch(profileDir: string, query: string, mode: WebSearchMode): Promise<WebSearchDecision> {
  if (mode === 'off') {
    return {
      mode,
      enabled: false,
      reason: 'web search disabled by mode',
      knowledgeTopScore: 0,
      knowledgeHitCount: 0,
    }
  }

  const domains = detectDomains(query)
  const knowledgeMatches = await scoreKnowledge(path.join(profileDir, 'knowledge'), domains, query)
  const knowledgeTopScore = knowledgeMatches[0]?.score ?? 0
  const knowledgeHitCount = knowledgeMatches.filter((match) => match.score > 0).length

  if (matchesAny(EXPLICIT_SEARCH_PATTERNS, query)) {
    return {
      mode,
      enabled: true,
      reason: 'user explicitly asked to search',
      knowledgeTopScore,
      knowledgeHitCount,
    }
  }

  if (matchesAny(FRESHNESS_PATTERNS, query)) {
    return {
      mode,
      enabled: true,
      reason: 'query is time-sensitive',
      knowledgeTopScore,
      knowledgeHitCount,
    }
  }

  if (knowledgeHitCount > 0 || knowledgeTopScore > 0) {
    return {
      mode,
      enabled: false,
      reason: 'relevant local memory found',
      knowledgeTopScore,
      knowledgeHitCount,
    }
  }

  if (matchesAny(STABLE_REASONING_PATTERNS, query) && !matchesAny(FACTUAL_PATTERNS, query)) {
    return {
      mode,
      enabled: false,
      reason: 'stable reasoning question without freshness signal',
      knowledgeTopScore,
      knowledgeHitCount,
    }
  }

  if (matchesAny(FACTUAL_PATTERNS, query)) {
    return {
      mode,
      enabled: true,
      reason: 'factual question without relevant local memory',
      knowledgeTopScore,
      knowledgeHitCount,
    }
  }

  return {
    mode,
    enabled: false,
    reason: 'default to local-only answer',
    knowledgeTopScore,
    knowledgeHitCount,
  }
}

export async function runChat(body: ChatRequest, clientOptions?: { timeout?: number; maxRetries?: number }): Promise<RunChatResult> {
  const { profileId, messages, webSearchMode = 'auto' } = body
  if (!profileId || !messages?.length) {
    throw new Error('profileId and messages are required')
  }

  const userQuery = messages.filter((m) => m.role === 'user').pop()?.content ?? ''
  const profileDir = path.join(PROFILES_DIR, profileId)
  const systemPrompt = await assembleSystemPrompt(profileDir, userQuery)
  const webSearch = await decideWebSearch(profileDir, userQuery, webSearchMode)
  const { apiKey, baseURL, modelName } = getOpenAIConfig()
  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: clientOptions?.timeout,
    maxRetries: clientOptions?.maxRetries,
  })

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'system',
      content: webSearch.enabled
        ? `${RESPONSE_FORMAT_GUARD}\n\n你可以使用 web search 工具，但只有在本地画像和本地记忆不足以回答，或需要确认最新事实时才使用。`
        : `${RESPONSE_FORMAT_GUARD}\n\n本轮不要依赖外部搜索，只使用本地画像、记忆和用户消息回答。`,
    },
    ...messages.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
  ]

  const request: Record<string, unknown> = {
    model: modelName,
    max_tokens: 2048,
    messages: openaiMessages,
    stream: false,
  }

  if (webSearch.enabled) {
    request.tools = [WEB_SEARCH_TOOL]
    request.tool_choice = 'auto'
  }

  const response = await client.chat.completions.create(request as unknown as OpenAI.Chat.ChatCompletionCreateParams) as OpenAI.Chat.ChatCompletion

  return {
    content: response.choices[0]?.message?.content ?? '',
    modelName,
    baseURL,
    webSearch,
  }
}
