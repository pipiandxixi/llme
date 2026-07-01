import path from 'path'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'
import OpenAI from 'openai'

const PROJECT_ROOT = process.cwd()
loadEnv({ path: path.join(PROJECT_ROOT, '.env') })

const rawConnectionString = process.env.POSTGRES_URL?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim()

if (!rawConnectionString) {
  throw new Error('Missing POSTGRES_URL or POSTGRES_URL_NON_POOLING in .env')
}

function normalizeConnectionString(raw: string) {
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('sslcert')
  url.searchParams.delete('sslkey')
  url.searchParams.delete('sslrootcert')
  return url.toString()
}

const connectionString = normalizeConnectionString(rawConnectionString)

function parseArgs() {
  const args = process.argv.slice(2)
  const profileIndex = args.findIndex((arg) => arg === '--profile')
  const profileId = profileIndex >= 0 ? args[profileIndex + 1] : null
  if (!profileId) {
    throw new Error('Usage: npm run process:memory -- --profile <profile-id>')
  }
  return { profileId }
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const baseURL = process.env.OPENAI_BASE_URL?.trim()
  const modelName = process.env.OPENAI_MODEL_NAME?.trim()
  if (!apiKey || !baseURL || !modelName) {
    throw new Error('Missing OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL_NAME in .env')
  }
  return { apiKey, baseURL, modelName }
}

interface MemoryRow {
  id: string
  kind: 'entry' | 'decision'
  slug: string
  title: string | null
  body_md: string
  happened_on: string | null
  memory_type: string | null
  domains: string[]
  tags: string[]
}

interface KnowledgeNodeRow {
  id: string
  slug: string
  title: string
  summary: string
  body_md: string
  domains: string[]
  tags: string[]
}

interface ExtractedConcept {
  slug: string
  title: string
  domains?: string[]
  tags?: string[]
  summary: string
  body_md: string
  action: 'create' | 'update'
  source_slugs?: string[]
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseListField(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

// Uses a delimiter-based plain-text protocol instead of JSON: the model output
// carries large free-form Markdown bodies that weak models frequently fail to
// escape correctly as JSON string values (unescaped quotes/newlines break JSON.parse).
function parseConcepts(raw: string): ExtractedConcept[] {
  const blocks = raw.split('===CONCEPT===').slice(1)
  const concepts: ExtractedConcept[] = []

  for (const block of blocks) {
    const [headerPart, bodyPart] = block.split('---BODY---')
    if (bodyPart === undefined) continue
    const body = bodyPart.split('===END===')[0].trim()

    const fields: Record<string, string> = {}
    for (const line of headerPart.split('\n')) {
      const ci = line.indexOf(':')
      if (ci <= 0) continue
      const key = line.slice(0, ci).trim().toLowerCase()
      const value = line.slice(ci + 1).trim()
      fields[key] = value
    }

    if (!fields.slug && !fields.title) continue

    concepts.push({
      slug: fields.slug ?? '',
      title: fields.title ?? fields.slug ?? '',
      domains: parseListField(fields.domains),
      tags: parseListField(fields.tags),
      summary: fields.summary ?? '',
      body_md: body,
      action: fields.action === 'update' ? 'update' : 'create',
      source_slugs: parseListField(fields.source_slugs),
    })
  }

  return concepts
}

async function fetchMemoryItems(pool: Pool, dbProfileId: string): Promise<MemoryRow[]> {
  const result = await pool.query<MemoryRow>(
    `select id, kind, slug, title, body_md, happened_on, memory_type, domains, tags
     from public.memory_items
     where profile_id = $1 and kind in ('entry', 'decision')
     order by happened_on asc nulls last, slug asc`,
    [dbProfileId],
  )
  return result.rows
}

async function fetchKnowledgeNodes(pool: Pool, dbProfileId: string): Promise<KnowledgeNodeRow[]> {
  const result = await pool.query<KnowledgeNodeRow>(
    `select id, slug, title, summary, body_md, domains, tags
     from public.knowledge_nodes
     where profile_id = $1
     order by slug asc`,
    [dbProfileId],
  )
  return result.rows
}

function buildPrompt(memoryItems: MemoryRow[], existingNodes: KnowledgeNodeRow[]): string {
  const existingBlock = existingNodes.length
    ? existingNodes
      .map((n) => `### ${n.slug}\n标题: ${n.title}\n摘要: ${n.summary}\n标签: ${(n.tags ?? []).join(', ')}\n领域: ${(n.domains ?? []).join(', ')}\n正文:\n${n.body_md}`)
      .join('\n\n')
    : '（暂无已有 Wiki 页面）'

  const rawBlock = memoryItems
    .map((m) => `### [${m.kind}] ${m.slug}${m.happened_on ? ` (${m.happened_on})` : ''}\n类型: ${m.memory_type ?? ''}\n领域: ${(m.domains ?? []).join(', ')}\n标签: ${(m.tags ?? []).join(', ')}\n正文:\n${m.body_md}`)
    .join('\n\n')

  return `你是一个知识整理助手，负责将某个数字人的原始知识条目（entry）和决策日志（decision），按照 Andrej Karpathy 提倡的 "LLM-Wiki" 模式，提炼合并为高信息密度、互相关联的 Wiki 主题页面。

## 规则
1. 通读全部原始条目，识别反复出现的核心主题、概念或领域判断。
2. 将同一主题下的相关内容合并为一个 Wiki 页面，去除口语化和重复内容，只保留核心判断与依据。
3. 如果某个主题在"现有 Wiki 页面"中已经存在（slug 相同或主题明显对应），该页面 action 填 "update"，需要结合旧正文与新证据重新组织，而不是简单拼接旧内容。
4. 如果是全新主题，action 填 "create"。
5. 每个页面必须列出 source_slugs：贡献了该页面内容的所有原始条目 slug（必须和下方"原始条目"里的 slug 完全一致）。
6. tags 使用简短的中文或英文关键词数组；domains 从 [tech, business, product, people, life] 中选择，可多选。
7. slug 使用小写英文单词加短横线（kebab-case），确保能稳定代表该主题（同一主题多次运行应该得到相同 slug）。

## 现有 Wiki 页面
${existingBlock}

## 原始条目
${rawBlock}

## 输出格式
你必须严格按照下面的纯文本格式输出，可以包含任意多个页面，不要输出 JSON，不要输出 Markdown 代码块围栏（\`\`\`），不要输出任何解释文字：

===CONCEPT===
slug: kebab-case-slug
title: 页面标题
domains: tech, business
tags: tag1, tag2
action: create
source_slugs: 2026-01-01-example, decision-2026-02-01-01
summary: 一到两句话的高度概括
---BODY---
完整的 Markdown 正文，可以包含小标题、列表、引号、换行，不需要任何转义。
===END===

以此类推输出更多页面。`
}

async function extractConcepts(client: OpenAI, modelName: string, prompt: string): Promise<ExtractedConcept[]> {
  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = response.choices[0]?.message?.content ?? ''
  return parseConcepts(raw)
}

async function upsertKnowledgeNode(
  pool: Pool,
  dbProfileId: string,
  profileId: string,
  concept: ExtractedConcept,
): Promise<{ id: string; action: 'insert' | 'update' }> {
  const slug = slugify(concept.slug || concept.title)

  const existing = await pool.query<{ id: string }>(
    `select id from public.knowledge_nodes where profile_id = $1 and slug = $2`,
    [dbProfileId, slug],
  )
  const action: 'insert' | 'update' = existing.rows.length ? 'update' : 'insert'

  const result = await pool.query<{ id: string }>(
    `insert into public.knowledge_nodes
       (profile_id, slug, title, summary, body_md, node_type, domains, tags, source_path, metadata)
     values
       ($1, $2, $3, $4, $5, 'wiki', $6::text[], $7::text[], $8, $9::jsonb)
     on conflict (profile_id, slug) do update
       set title = excluded.title,
           summary = excluded.summary,
           body_md = excluded.body_md,
           domains = excluded.domains,
           tags = excluded.tags,
           metadata = excluded.metadata
     returning id`,
    [
      dbProfileId,
      slug,
      concept.title,
      concept.summary,
      concept.body_md,
      concept.domains ?? [],
      concept.tags ?? [],
      `profiles/${profileId}/knowledge (auto-generated)`,
      JSON.stringify({ generated_by: 'process-memory-script', source_slugs: concept.source_slugs ?? [] }),
    ],
  )

  return { id: result.rows[0].id, action }
}

async function linkSources(pool: Pool, dbProfileId: string, knowledgeNodeId: string, sourceSlugs: string[]) {
  if (!sourceSlugs.length) return

  const memoryItems = await pool.query<{ id: string }>(
    `select id from public.memory_items
     where profile_id = $1 and slug = any($2::text[]) and kind in ('entry', 'decision')`,
    [dbProfileId, sourceSlugs],
  )

  for (const row of memoryItems.rows) {
    await pool.query(
      `insert into public.knowledge_node_sources (knowledge_node_id, memory_item_id, relation)
       values ($1, $2, 'source')
       on conflict (knowledge_node_id, memory_item_id) do nothing`,
      [knowledgeNodeId, row.id],
    )
  }
}

async function recordRevision(pool: Pool, dbProfileId: string, knowledgeNodeId: string, action: 'insert' | 'update') {
  const snapshot = await pool.query(`select * from public.knowledge_nodes where id = $1`, [knowledgeNodeId])
  await pool.query(
    `insert into public.content_revisions (profile_id, entity_table, entity_id, action, editor, snapshot)
     values ($1, 'knowledge_nodes', $2, $3, $4, $5::jsonb)`,
    [dbProfileId, knowledgeNodeId, action, 'process-memory-script', JSON.stringify(snapshot.rows[0])],
  )
}

async function main() {
  const { profileId } = parseArgs()
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  const { apiKey, baseURL, modelName } = getOpenAIConfig()
  const client = new OpenAI({ apiKey, baseURL })

  try {
    const profileResult = await pool.query<{ id: string }>(
      `select id from public.profiles where slug = $1 and status <> 'archived'`,
      [profileId],
    )
    const dbProfileId = profileResult.rows[0]?.id
    if (!dbProfileId) {
      throw new Error(`Profile not found in DB: ${profileId}. Run import:profile first.`)
    }

    const [memoryItems, existingNodes] = await Promise.all([
      fetchMemoryItems(pool, dbProfileId),
      fetchKnowledgeNodes(pool, dbProfileId),
    ])

    if (memoryItems.length === 0) {
      console.log(JSON.stringify({ profileId, skipped: 'no memory items found' }, null, 2))
      return
    }

    const prompt = buildPrompt(memoryItems, existingNodes)
    const concepts = await extractConcepts(client, modelName, prompt)

    const summary: Array<{ slug: string; action: string; sources: number }> = []
    for (const concept of concepts) {
      const { id, action } = await upsertKnowledgeNode(pool, dbProfileId, profileId, concept)
      await linkSources(pool, dbProfileId, id, concept.source_slugs ?? [])
      await recordRevision(pool, dbProfileId, id, action)
      summary.push({ slug: slugify(concept.slug || concept.title), action, sources: concept.source_slugs?.length ?? 0 })
    }

    console.log(JSON.stringify({ profileId, memoryItemCount: memoryItems.length, processedConcepts: summary }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
