import fs from 'fs/promises'
import path from 'path'
import type { ProfileMeta } from '../../types'
import { PROFILES_DIR } from '../../config'
import { getPostgresPool } from './postgres-client'
import type { ContentStore, KnowledgeMatch, ProfileDocument, ProfileSections } from './types'

interface SectionRow {
  layer: string
  section_key: string
  title: string | null
  body_md: string
  stability: string | null
  last_updated: string | null
  source_path: string | null
  position: number
}

interface MemoryRow {
  slug: string
  title: string | null
  body_md: string
  happened_on: string | null
  memory_type: string | null
  domains: string[] | null
  tags: string[] | null
  confidence: string | null
  outcome: string | null
  source_label: string | null
  source_path: string | null
  kind: string
}

interface ProfileListRow {
  id: string
  name: string
  description: string | null
  avatar: string | null
}

function makeFrontmatter(lines: Array<[string, string | undefined]>): string {
  const body = lines
    .filter(([, value]) => value && value.length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  return body ? `---\n${body}\n---\n\n` : ''
}

export class PostgresContentStore implements ContentStore {
  private readonly pool = getPostgresPool()

  private async getProfileRow(profileId: string) {
    const result = await this.pool.query(
      `select id, slug, name, description, avatar_path
       from public.profiles
       where slug = $1 and status <> 'archived'
       limit 1`,
      [profileId],
    )
    return result.rows[0] as
      | { id: string; slug: string; name: string; description: string; avatar_path: string | null }
      | undefined
  }

  async listProfiles(): Promise<ProfileMeta[]> {
    const result = await this.pool.query<ProfileListRow>(
      `select slug as id, name, description, avatar_path as avatar
       from public.profiles
       where status <> 'archived'
       order by slug asc`,
    )
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      avatar: row.avatar ?? undefined,
    }))
  }

  async loadProfileMeta(profileId: string): Promise<ProfileMeta> {
    const row = await this.getProfileRow(profileId)
    if (!row) {
      throw new Error(`Profile not found: ${profileId}`)
    }
    return {
      id: row.slug,
      name: row.name,
      description: row.description ?? '',
      avatar: row.avatar_path ?? undefined,
    }
  }

  async loadProfileSections(profileId: string): Promise<ProfileSections> {
    const profile = await this.getProfileRow(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    const result = await this.pool.query<SectionRow>(
      `select layer, section_key, title, body_md, stability, last_updated, source_path, position
       from public.profile_sections
       where profile_id = $1
       order by layer asc, position asc, section_key asc`,
      [profile.id],
    )

    const sections: ProfileSections = { core: [], cognition: [], context: [], domains: [] }
    for (const row of result.rows) {
      if (row.layer === 'core') sections.core.push(row.body_md)
      if (row.layer === 'cognition') sections.cognition.push(row.body_md)
      if (row.layer === 'context') sections.context.push(row.body_md)
      if (row.layer === 'domain') sections.domains.push({ name: row.section_key, content: row.body_md })
    }
    return sections
  }

  async loadBasePrompt(profileId: string): Promise<string> {
    const meta = await this.loadProfileMeta(profileId)
    const templatePath = path.join(PROFILES_DIR, '_shared/system/base_prompt.md')
    const template = (await fs.readFile(templatePath, 'utf-8')).replace(/^---[\s\S]*?---\n/, '').trim()
    return template
      .replaceAll('{{profile_id}}', meta.id)
      .replaceAll('{{profile_name}}', meta.name)
      .replaceAll('{{profile_description}}', meta.description)
  }

  async loadProfileDocuments(profileId: string): Promise<ProfileDocument[]> {
    const profile = await this.getProfileRow(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    const [sectionsResult, memoryResult] = await Promise.all([
      this.pool.query<SectionRow>(
        `select layer, section_key, title, body_md, stability, last_updated, source_path, position
         from public.profile_sections
         where profile_id = $1
         order by layer asc, position asc, section_key asc`,
        [profile.id],
      ),
      this.pool.query<MemoryRow>(
        `select slug, title, body_md, happened_on, memory_type, domains, tags, confidence, outcome, source_label, source_path, kind
         from public.memory_items
         where profile_id = $1 and kind in ('entry', 'decision')
         order by happened_on desc nulls last, slug desc`,
        [profile.id],
      ),
    ])

    const documents: ProfileDocument[] = [{
      path: 'meta.yaml',
      name: 'meta',
      section: 'profile',
      format: 'yaml',
      content: `name: "${profile.name}"\ndescription: "${profile.description.replace(/"/g, '\\"')}"${profile.avatar_path ? `\navatar: "${profile.avatar_path}"` : ''}\n`,
    }]

    for (const row of sectionsResult.rows) {
      const metadata = makeFrontmatter([
        ['layer', row.layer === 'domain' ? 'domains' : row.layer],
        ['last_updated', row.last_updated ?? undefined],
        ['stability', row.stability ?? undefined],
      ])
      const documentPath =
        row.layer === 'domain' ? `profile/domains/${row.section_key}.md` :
        row.layer === 'system' ? `system/${row.section_key}.md` :
        `${row.layer === 'public_presence' ? 'profile' : `profile/${row.layer}`}/${row.section_key}.md`

      documents.push({
        path: documentPath,
        name: row.section_key,
        section: row.layer === 'system' ? 'system' : 'profile',
        format: 'markdown',
        content: `${metadata}${row.body_md}\n`,
      })
    }

    for (const row of memoryResult.rows) {
      const metadata = makeFrontmatter([
        ['date', row.happened_on ?? undefined],
        ['domain', row.domains?.length ? `[${row.domains.join(', ')}]` : undefined],
        ['tags', row.tags?.length ? `[${row.tags.join(', ')}]` : undefined],
        ['type', row.memory_type ?? undefined],
        ['confidence', row.confidence ?? undefined],
        ['outcome', row.outcome ?? undefined],
        ['source', row.source_label ?? undefined],
      ])
      documents.push({
        path: `${row.kind === 'decision' ? 'knowledge/decisions' : 'knowledge/entries'}/${row.slug}.md`,
        name: row.slug,
        section: 'knowledge',
        format: 'markdown',
        content: `${metadata}${row.body_md}\n`,
      })
    }

    return documents
  }

  async scoreKnowledge(profileId: string, domains: string[], query: string): Promise<KnowledgeMatch[]> {
    const profile = await this.getProfileRow(profileId)
    if (!profile) return []

    const result = await this.pool.query<MemoryRow>(
      `select slug, title, body_md, happened_on, memory_type, domains, tags, confidence, outcome, source_label, source_path, kind
       from public.memory_items
       where profile_id = $1
         and kind in ('entry', 'decision')
         and (cardinality($2::text[]) = 0 or domains && $2::text[])
       order by kind desc, happened_on desc nulls last, slug desc`,
      [profile.id, domains],
    )

    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return result.rows
      .map((row: MemoryRow) => {
        const tags = row.tags ?? []
        const score = tags.filter((tag: string) => queryTokens.some((token) => tag.toLowerCase().includes(token))).length
        return { content: row.body_md, score }
      })
      .sort((a: KnowledgeMatch, b: KnowledgeMatch) => b.score - a.score)
      .slice(0, 10)
  }

  async retrieveKnowledge(profileId: string, domains: string[], query: string): Promise<string[]> {
    const scored = await this.scoreKnowledge(profileId, domains, query)
    return scored.map((entry) => entry.content)
  }
}
