import type { Pool } from 'pg'
import OpenAI from 'openai'
import { getPostgresPool, withRetry } from './storage/postgres-client'
import { getOpenAIConfig } from '../config'

export type ProfileLayer = 'core' | 'cognition' | 'context' | 'domain'
export type MemoryKind = 'entry' | 'decision'

export interface ProfileSectionRecord {
  layer: ProfileLayer
  sectionKey: string
  title: string | null
  bodyMd: string
  stability: 'high' | 'medium' | 'low' | null
  lastUpdated: string | null
}

export interface MemoryItemRecord {
  kind: MemoryKind
  slug: string
  title: string | null
  bodyMd: string
  happenedOn: string | null
  domains: string[]
  tags: string[]
  memoryType: string | null
  confidence: 'high' | 'medium' | 'low' | null
  outcome: 'pending' | 'validated' | 'invalidated' | null
  sourceLabel: string | null
}

export interface RawMaterial {
  id: string
  slug: string
  title: string | null
  bodyMd: string
  sourceLabel: string | null
  processingStatus: string
  createdAt: string
}

export interface ContentProposal {
  id: string
  targetType: 'memory_item' | 'profile_section'
  action: 'create' | 'update'
  layer: ProfileLayer | null
  sectionKey: string | null
  memoryKind: MemoryKind | null
  slug: string | null
  title: string | null
  proposedBodyMd: string
  proposedMetadata: Record<string, unknown>
  previousBodyMd: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export class AdminModeError extends Error {}

function assertPostgresMode() {
  if ((process.env.LLME_CONTENT_STORE || 'file').trim().toLowerCase() !== 'postgres') {
    throw new AdminModeError('编辑功能仅在 Postgres 存储模式下可用')
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferTitle(body: string, fallback: string): string {
  const heading = body.split('\n').find((line) => /^#\s+/.test(line.trim()))
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback
}

function parseListField(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

async function getProfileRow(profileId: string): Promise<{ id: string }> {
  const pool = getPostgresPool()
  const result = await pool.query<{ id: string }>(
    `select id from public.profiles where slug = $1 and status <> 'archived'`,
    [profileId],
  )
  const row = result.rows[0]
  if (!row) throw new Error(`Profile not found: ${profileId}`)
  return row
}

async function recordRevision(
  pool: Pool,
  profileDbId: string,
  entityTable: 'profile_sections' | 'memory_items',
  entityId: string,
  action: 'insert' | 'update',
  snapshot: unknown,
  editor: string,
) {
  await pool.query(
    `insert into public.content_revisions (profile_id, entity_table, entity_id, action, editor, snapshot)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [profileDbId, entityTable, entityId, action, editor, JSON.stringify(snapshot)],
  )
}

async function ensureUniqueSlug(
  pool: Pool,
  dbProfileId: string,
  kind: MemoryKind | 'raw',
  baseSlug: string,
  usedInBatch: Set<string>,
): Promise<string> {
  let slug = baseSlug || `${kind}-item`
  for (let attempt = 0; ; attempt++) {
    if (!usedInBatch.has(slug)) {
      const existing = await pool.query(
        `select 1 from public.memory_items where profile_id = $1 and kind = $2 and slug = $3`,
        [dbProfileId, kind, slug],
      )
      if (existing.rows.length === 0) break
    }
    slug = `${baseSlug}-${attempt + 2}`
  }
  usedInBatch.add(slug)
  return slug
}

// ---------- read for editing ----------

export async function listProfileSectionsForEdit(profileId: string): Promise<ProfileSectionRecord[]> {
  assertPostgresMode()
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()
  const result = await pool.query(
    `select layer, section_key, title, body_md, stability, last_updated
     from public.profile_sections
     where profile_id = $1 and layer in ('core', 'cognition', 'context', 'domain')
     order by layer asc, position asc, section_key asc`,
    [profile.id],
  )
  return result.rows.map((row) => ({
    layer: row.layer,
    sectionKey: row.section_key,
    title: row.title,
    bodyMd: row.body_md,
    stability: row.stability,
    lastUpdated: row.last_updated,
  }))
}

export async function listMemoryItemsForEdit(profileId: string): Promise<MemoryItemRecord[]> {
  assertPostgresMode()
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()
  const result = await pool.query(
    `select kind, slug, title, body_md, happened_on, domains, tags, memory_type, confidence, outcome, source_label
     from public.memory_items
     where profile_id = $1 and kind in ('entry', 'decision')
     order by kind desc, happened_on desc nulls last, slug desc`,
    [profile.id],
  )
  return result.rows.map((row) => ({
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    bodyMd: row.body_md,
    happenedOn: row.happened_on,
    domains: row.domains ?? [],
    tags: row.tags ?? [],
    memoryType: row.memory_type,
    confidence: row.confidence,
    outcome: row.outcome,
    sourceLabel: row.source_label,
  }))
}

// ---------- direct edit of existing content ----------

export async function updateProfileSection(
  profileId: string,
  layer: ProfileLayer,
  sectionKey: string,
  bodyMd: string,
): Promise<void> {
  assertPostgresMode()
  const pool = getPostgresPool()
  const today = new Date().toISOString().slice(0, 10)

  // Single round trip: resolve profile + update in one query instead of a
  // separate profile lookup first, and retry once on transient connection
  // drops instead of hanging until Vercel's own function timeout kills it.
  const row = await withRetry(async () => {
    const result = await pool.query(
      `update public.profile_sections
       set body_md = $4, last_updated = $5::date
       where profile_id = (select id from public.profiles where slug = $1 and status <> 'archived')
         and layer = $2 and section_key = $3
       returning *`,
      [profileId, layer, sectionKey, bodyMd, today],
    )
    const row = result.rows[0]
    if (!row) throw new Error(`Section not found: ${layer}/${sectionKey}`)
    return row
  })

  await withRetry(() => recordRevision(pool, row.profile_id, 'profile_sections', row.id, 'update', row, 'admin-ui'))
}

export interface MemoryItemUpdateFields {
  bodyMd: string
  domains: string[]
  tags: string[]
  memoryType?: string | null
  confidence?: string | null
  outcome?: string | null
  sourceLabel?: string | null
}

export async function updateMemoryItem(
  profileId: string,
  kind: MemoryKind,
  slug: string,
  fields: MemoryItemUpdateFields,
): Promise<void> {
  assertPostgresMode()
  const pool = getPostgresPool()

  const row = await withRetry(async () => {
    const result = await pool.query(
      `update public.memory_items
       set body_md = $4,
           domains = $5::text[],
           tags = $6::text[],
           memory_type = $7,
           confidence = $8,
           outcome = $9,
           source_label = $10
       where profile_id = (select id from public.profiles where slug = $1 and status <> 'archived')
         and kind = $2 and slug = $3
       returning *`,
      [
        profileId,
        kind,
        slug,
        fields.bodyMd,
        fields.domains,
        fields.tags,
        fields.memoryType ?? null,
        fields.confidence ?? null,
        fields.outcome ?? null,
        fields.sourceLabel ?? null,
      ],
    )
    const row = result.rows[0]
    if (!row) throw new Error(`Memory item not found: ${kind}/${slug}`)
    return row
  })

  await withRetry(() => recordRevision(pool, row.profile_id, 'memory_items', row.id, 'update', row, 'admin-ui'))
}

// ---------- raw material submission ----------

export async function submitRawMaterial(
  profileId: string,
  input: { title?: string; bodyMd: string; sourceLabel?: string },
): Promise<{ id: string; slug: string }> {
  assertPostgresMode()
  if (!input.bodyMd.trim()) throw new Error('内容不能为空')
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()
  const today = new Date().toISOString().slice(0, 10)
  const baseSlug = `raw-${today}-${slugify(input.title || input.bodyMd.slice(0, 24)) || 'note'}`
  const slug = await ensureUniqueSlug(pool, profile.id, 'raw', baseSlug, new Set())

  const result = await pool.query(
    `insert into public.memory_items (profile_id, kind, slug, title, body_md, happened_on, source_label, processing_status)
     values ($1, 'raw', $2, $3, $4, $5::date, $6, 'pending_processing')
     returning id, slug`,
    [profile.id, slug, input.title ?? null, input.bodyMd, today, input.sourceLabel ?? null],
  )
  return { id: result.rows[0].id, slug: result.rows[0].slug }
}

export async function listRawMaterials(profileId: string): Promise<RawMaterial[]> {
  assertPostgresMode()
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()
  const result = await pool.query(
    `select id, slug, title, body_md, source_label, processing_status, created_at
     from public.memory_items
     where profile_id = $1 and kind = 'raw'
     order by created_at desc`,
    [profile.id],
  )
  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    bodyMd: row.body_md,
    sourceLabel: row.source_label,
    processingStatus: row.processing_status,
    createdAt: row.created_at,
  }))
}

// ---------- analysis pipeline ----------

interface RawMaterialRow {
  id: string
  slug: string
  title: string | null
  body_md: string
  source_label: string | null
}

interface SectionContextRow {
  layer: ProfileLayer
  section_key: string
  title: string | null
  body_md: string
}

interface MemoryContextRow {
  kind: string
  slug: string
  domains: string[]
  tags: string[]
}

async function loadRawMaterial(pool: Pool, dbProfileId: string, rawId: string): Promise<RawMaterialRow> {
  const result = await pool.query<RawMaterialRow>(
    `select id, slug, title, body_md, source_label
     from public.memory_items
     where id = $1 and profile_id = $2 and kind = 'raw'`,
    [rawId, dbProfileId],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Raw material not found')
  return row
}

function buildAnalysisPrompt(raw: RawMaterialRow, sections: SectionContextRow[], memoryItems: MemoryContextRow[]): string {
  const sectionsBlock = sections
    .map((s) => `### ${s.layer}/${s.section_key}\n标题: ${s.title ?? ''}\n正文:\n${s.body_md}`)
    .join('\n\n')

  const memoryBlock = memoryItems.length
    ? memoryItems.map((m) => `- [${m.kind}] ${m.slug} (domain: ${(m.domains ?? []).join(',')}, tags: ${(m.tags ?? []).join(',')})`).join('\n')
    : '（暂无）'

  return `你是一个知识整理助手，负责分析用户新提交的一段补充资料（可能是文章、访谈、对话记录等），判断其中哪些内容值得：
1. 作为新的"记忆条目"（entry，日常观点/事实/框架/反思）或"决策日志"（decision，一次具体决策的场景/选项/推理/验证）补充进该数字人的记忆库；
2. 用于更新该数字人现有的"画像"章节（价值观/信念/性格/思维框架/决策模式/认知偏差/领域认知/当前情境/人际关系/外部环境等），当资料里出现了和某个已有章节相关的新信息、修正或补充时。

## 规则
- 不要重复已经存在的记忆条目（见下方"已有记忆条目列表"），只提取资料里真正新增的信息。
- 如果资料内容和某个已有画像章节强相关（比如新的工作重心、新的人际关系变化、对某个领域判断的更新），生成一条 SECTION 更新建议，正文要结合"该章节现有正文"重新整理成一份完整、连贯的新正文，而不是简单地把新内容拼接在后面。
- 如果资料本身就是一次具体决策的描述（有场景、选项对比、推理过程），生成一条 kind=decision 的 MEMORY 建议，正文按"场景/选项对比/决策及推理/后续验证"四段式整理（没有后续验证可以留空或省略该段）。
- 如果只是零散的观点、事实或框架性总结，生成一条 kind=entry 的 MEMORY 建议。
- 一段资料可能同时产生多条 MEMORY 建议和多条 SECTION 建议，也可能什么都不需要生成（如果资料价值很低）。
- tags 使用简短的中文或英文关键词数组；domains 从 [tech, business, product, people, life] 中选择，可多选。

## 已有画像章节（供你判断是否需要更新）
${sectionsBlock}

## 已有记忆条目列表（避免重复）
${memoryBlock}

## 待分析的新资料
标题: ${raw.title ?? '（无标题）'}
来源: ${raw.source_label ?? '（未标注）'}
正文:
${raw.body_md}

## 输出格式
严格按照下面的纯文本格式输出，不要输出 JSON，不要输出 Markdown 代码块围栏，不要输出任何解释文字。可以输出 0 条、1 条或多条 MEMORY/SECTION 块：

===MEMORY===
kind: entry
slug: kebab-case-slug
title: 标题
domains: tech, business
tags: tag1, tag2
confidence: medium
source_label: 补充资料：${raw.title ?? raw.slug}
---BODY---
完整正文
===END===

===SECTION===
layer: context
section_key: current_focus
---BODY---
结合旧正文重新整理后的完整新正文
===END===

如果没有值得记录的内容，不要输出任何 MEMORY/SECTION 块，直接输出空内容。`
}

interface ParsedMemoryProposal {
  kind: MemoryKind
  slug: string
  title: string
  domains: string[]
  tags: string[]
  confidence: string | null
  sourceLabel: string | null
  bodyMd: string
}

interface ParsedSectionProposal {
  layer: ProfileLayer
  sectionKey: string
  bodyMd: string
}

function parseHeaderFields(headerPart: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of headerPart.split('\n')) {
    const ci = line.indexOf(':')
    if (ci <= 0) continue
    fields[line.slice(0, ci).trim().toLowerCase()] = line.slice(ci + 1).trim()
  }
  return fields
}

function parseAnalysisOutput(raw: string): { memoryProposals: ParsedMemoryProposal[]; sectionProposals: ParsedSectionProposal[] } {
  const memoryProposals: ParsedMemoryProposal[] = []
  const sectionProposals: ParsedSectionProposal[] = []

  for (const block of raw.split('===MEMORY===').slice(1)) {
    const [headerPart, bodyPart] = block.split('---BODY---')
    if (bodyPart === undefined) continue
    const body = bodyPart.split('===END===')[0].trim()
    const fields = parseHeaderFields(headerPart)
    if (!fields.slug || !body) continue
    memoryProposals.push({
      kind: fields.kind === 'decision' ? 'decision' : 'entry',
      slug: slugify(fields.slug),
      title: fields.title ?? fields.slug,
      domains: parseListField(fields.domains),
      tags: parseListField(fields.tags),
      confidence: fields.confidence ?? null,
      sourceLabel: fields.source_label ?? null,
      bodyMd: body,
    })
  }

  for (const block of raw.split('===SECTION===').slice(1)) {
    const [headerPart, bodyPart] = block.split('---BODY---')
    if (bodyPart === undefined) continue
    const body = bodyPart.split('===END===')[0].trim()
    const fields = parseHeaderFields(headerPart)
    if (!fields.layer || !fields.section_key || !body) continue
    if (!['core', 'cognition', 'context', 'domain'].includes(fields.layer)) continue
    sectionProposals.push({
      layer: fields.layer as ProfileLayer,
      sectionKey: fields.section_key,
      bodyMd: body,
    })
  }

  return { memoryProposals, sectionProposals }
}

interface ProposalRow {
  id: string
  profile_id: string
  target_type: 'memory_item' | 'profile_section'
  action: 'create' | 'update'
  layer: ProfileLayer | null
  section_key: string | null
  memory_kind: MemoryKind | null
  slug: string | null
  title: string | null
  proposed_body_md: string
  proposed_metadata: Record<string, unknown>
  previous_body_md: string | null
  status: 'pending' | 'approved' | 'rejected'
  source_memory_item_id: string | null
  created_at: string
}

function mapProposalRow(row: ProposalRow): ContentProposal {
  return {
    id: row.id,
    targetType: row.target_type,
    action: row.action,
    layer: row.layer,
    sectionKey: row.section_key,
    memoryKind: row.memory_kind,
    slug: row.slug,
    title: row.title,
    proposedBodyMd: row.proposed_body_md,
    proposedMetadata: row.proposed_metadata ?? {},
    previousBodyMd: row.previous_body_md,
    status: row.status,
    createdAt: row.created_at,
  }
}

export async function analyzeRawMaterial(profileId: string, rawMemoryItemId: string): Promise<ContentProposal[]> {
  assertPostgresMode()
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()

  const raw = await loadRawMaterial(pool, profile.id, rawMemoryItemId)

  const [sectionsResult, memoryResult] = await Promise.all([
    pool.query<SectionContextRow>(
      `select layer, section_key, title, body_md
       from public.profile_sections
       where profile_id = $1 and layer in ('core', 'cognition', 'context', 'domain')
       order by layer asc, position asc, section_key asc`,
      [profile.id],
    ),
    pool.query<MemoryContextRow>(
      `select kind, slug, domains, tags
       from public.memory_items
       where profile_id = $1 and kind in ('entry', 'decision')`,
      [profile.id],
    ),
  ])

  const prompt = buildAnalysisPrompt(raw, sectionsResult.rows, memoryResult.rows)
  const { apiKey, baseURL, modelName } = getOpenAIConfig()
  const client = new OpenAI({ apiKey, baseURL })
  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })
  const rawOutput = response.choices[0]?.message?.content ?? ''
  const { memoryProposals, sectionProposals } = parseAnalysisOutput(rawOutput)

  const inserted: ContentProposal[] = []
  const usedSlugs = new Set<string>()

  for (const proposal of memoryProposals) {
    const slug = await ensureUniqueSlug(pool, profile.id, proposal.kind, proposal.slug, usedSlugs)
    const result = await pool.query<ProposalRow>(
      `insert into public.content_proposals
         (profile_id, source_memory_item_id, target_type, action, memory_kind, slug, title, proposed_body_md, proposed_metadata, status)
       values
         ($1, $2, 'memory_item', 'create', $3, $4, $5, $6, $7::jsonb, 'pending')
       returning *`,
      [
        profile.id,
        raw.id,
        proposal.kind,
        slug,
        proposal.title,
        proposal.bodyMd,
        JSON.stringify({
          domains: proposal.domains,
          tags: proposal.tags,
          confidence: proposal.confidence,
          sourceLabel: proposal.sourceLabel,
        }),
      ],
    )
    inserted.push(mapProposalRow(result.rows[0]))
  }

  for (const proposal of sectionProposals) {
    const existingSection = sectionsResult.rows.find(
      (s) => s.layer === proposal.layer && s.section_key === proposal.sectionKey,
    )
    const title = inferTitle(proposal.bodyMd, existingSection?.title ?? proposal.sectionKey)
    const result = await pool.query<ProposalRow>(
      `insert into public.content_proposals
         (profile_id, source_memory_item_id, target_type, action, layer, section_key, title, proposed_body_md, previous_body_md, status)
       values
         ($1, $2, 'profile_section', $3, $4, $5, $6, $7, $8, 'pending')
       returning *`,
      [
        profile.id,
        raw.id,
        existingSection ? 'update' : 'create',
        proposal.layer,
        proposal.sectionKey,
        title,
        proposal.bodyMd,
        existingSection?.body_md ?? null,
      ],
    )
    inserted.push(mapProposalRow(result.rows[0]))
  }

  if (inserted.length === 0) {
    await pool.query(`update public.memory_items set processing_status = 'processed' where id = $1`, [raw.id])
  }

  return inserted
}

export async function listProposals(profileId: string, status?: string): Promise<ContentProposal[]> {
  assertPostgresMode()
  const profile = await getProfileRow(profileId)
  const pool = getPostgresPool()
  const result = await pool.query<ProposalRow>(
    status
      ? `select * from public.content_proposals where profile_id = $1 and status = $2 order by created_at desc`
      : `select * from public.content_proposals where profile_id = $1 order by created_at desc`,
    status ? [profile.id, status] : [profile.id],
  )
  return result.rows.map(mapProposalRow)
}

async function maybeMarkRawProcessed(pool: Pool, rawMemoryItemId: string | null) {
  if (!rawMemoryItemId) return
  const pending = await pool.query(
    `select 1 from public.content_proposals where source_memory_item_id = $1 and status = 'pending' limit 1`,
    [rawMemoryItemId],
  )
  if (pending.rows.length === 0) {
    await pool.query(`update public.memory_items set processing_status = 'processed' where id = $1`, [rawMemoryItemId])
  }
}

export async function decideProposal(proposalId: string, decision: 'approve' | 'reject'): Promise<ContentProposal> {
  assertPostgresMode()
  const pool = getPostgresPool()

  const current = await pool.query<ProposalRow>(`select * from public.content_proposals where id = $1`, [proposalId])
  const proposal = current.rows[0]
  if (!proposal) throw new Error('Proposal not found')
  if (proposal.status !== 'pending') throw new Error('Proposal already decided')

  if (decision === 'reject') {
    const updated = await pool.query<ProposalRow>(
      `update public.content_proposals set status = 'rejected', reviewed_at = now() where id = $1 returning *`,
      [proposalId],
    )
    await maybeMarkRawProcessed(pool, proposal.source_memory_item_id)
    return mapProposalRow(updated.rows[0])
  }

  const today = new Date().toISOString().slice(0, 10)

  if (proposal.target_type === 'profile_section') {
    const sectionResult = await pool.query(
      `insert into public.profile_sections (profile_id, layer, section_key, title, body_md, last_updated)
       values ($1, $2, $3, $4, $5, $6::date)
       on conflict (profile_id, layer, section_key) do update
         set body_md = excluded.body_md,
             last_updated = excluded.last_updated
       returning *`,
      [proposal.profile_id, proposal.layer, proposal.section_key, proposal.title, proposal.proposed_body_md, today],
    )
    await recordRevision(
      pool,
      proposal.profile_id,
      'profile_sections',
      sectionResult.rows[0].id,
      proposal.action === 'create' ? 'insert' : 'update',
      sectionResult.rows[0],
      'admin-review',
    )
  } else {
    const metadata = proposal.proposed_metadata as {
      domains?: string[]
      tags?: string[]
      confidence?: string | null
      sourceLabel?: string | null
    }
    const memoryResult = await pool.query(
      `insert into public.memory_items
         (profile_id, kind, slug, title, body_md, happened_on, domains, tags, confidence, source_label, outcome)
       values
         ($1, $2, $3, $4, $5, $6::date, $7::text[], $8::text[], $9, $10, $11)
       returning *`,
      [
        proposal.profile_id,
        proposal.memory_kind,
        proposal.slug,
        proposal.title,
        proposal.proposed_body_md,
        today,
        metadata.domains ?? [],
        metadata.tags ?? [],
        metadata.confidence ?? null,
        metadata.sourceLabel ?? null,
        proposal.memory_kind === 'decision' ? 'pending' : null,
      ],
    )
    await recordRevision(pool, proposal.profile_id, 'memory_items', memoryResult.rows[0].id, 'insert', memoryResult.rows[0], 'admin-review')
  }

  const updated = await pool.query<ProposalRow>(
    `update public.content_proposals set status = 'approved', reviewed_at = now() where id = $1 returning *`,
    [proposalId],
  )
  await maybeMarkRawProcessed(pool, proposal.source_memory_item_id)
  return mapProposalRow(updated.rows[0])
}
