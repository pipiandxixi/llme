import fs from 'fs/promises'
import path from 'path'
import type { ProfileMeta } from '../../types'
import type { ContentStore, KnowledgeMatch, ProfileDocument, ProfileSections } from './types'

interface EntryMeta {
  domain?: string[]
  tags?: string[]
  date?: string
  type?: string
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n/, '').trim()
}

function parseSimpleYaml(yamlStr: string): Record<string, string> {
  const data: Record<string, string> = {}
  for (const line of yamlStr.split('\n')) {
    const ci = line.indexOf(':')
    if (ci <= 0) continue
    const key = line.slice(0, ci).trim()
    const val = line.slice(ci + 1).trim().replace(/^["']|["']$/g, '')
    data[key] = val
  }
  return data
}

function parseFrontmatter(raw: string): { meta: EntryMeta; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }
  const meta: EntryMeta = {}
  for (const line of match[1].split('\n')) {
    const ci = line.indexOf(':')
    if (ci <= 0) continue
    const key = line.slice(0, ci).trim() as keyof EntryMeta
    const val = line.slice(ci + 1).trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      (meta as Record<string, unknown>)[key] = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''))
    } else {
      (meta as Record<string, unknown>)[key] = val.replace(/^['"]|['"]$/g, '')
    }
  }
  return { meta, content: match[2].trim() }
}

export class FileContentStore implements ContentStore {
  constructor(private readonly profilesDir: string) {}

  private profileDir(profileId: string) {
    return path.join(this.profilesDir, profileId)
  }

  private async readProfileMetaFile(profileId: string): Promise<Record<string, string>> {
    const raw = await fs.readFile(path.join(this.profileDir(profileId), 'meta.yaml'), 'utf-8')
    const yamlStr = raw.includes('---')
      ? (raw.match(/^---\n([\s\S]*?)\n---/) ?? ['', ''])[1]
      : raw
    return parseSimpleYaml(yamlStr)
  }

  async listProfiles(): Promise<ProfileMeta[]> {
    const entries = await fs.readdir(this.profilesDir, { withFileTypes: true })
    const profiles: ProfileMeta[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = path.join(this.profilesDir, entry.name, 'meta.yaml')
      try {
        await fs.access(metaPath)
        const data = await this.readProfileMetaFile(entry.name)
        profiles.push({
          id: entry.name,
          name: data.name ?? entry.name,
          description: data.description ?? '',
          avatar: data.avatar?.trim() || undefined,
        })
      } catch {
        // skip directories without meta.yaml
      }
    }
    return profiles
  }

  async loadProfileMeta(profileId: string): Promise<ProfileMeta> {
    const data = await this.readProfileMetaFile(profileId)
    return {
      id: profileId,
      name: data.name ?? profileId,
      description: data.description ?? '',
      avatar: data.avatar?.trim() || undefined,
    }
  }

  private async readMarkdownFiles(dir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir)
      const mdFiles = files.filter(f => f.endsWith('.md')).sort()
      const contents: string[] = []
      for (const file of mdFiles) {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8')
        contents.push(stripFrontmatter(raw))
      }
      return contents
    } catch {
      return []
    }
  }

  async loadProfileSections(profileId: string): Promise<ProfileSections> {
    const profileDir = this.profileDir(profileId)
    const [core, cognition, context] = await Promise.all([
      this.readMarkdownFiles(path.join(profileDir, 'profile/core')),
      this.readMarkdownFiles(path.join(profileDir, 'profile/cognition')),
      this.readMarkdownFiles(path.join(profileDir, 'profile/context')),
    ])

    const domainsDir = path.join(profileDir, 'profile/domains')
    const domains: Array<{ name: string; content: string }> = []
    try {
      const domainFiles = (await fs.readdir(domainsDir)).filter(f => f.endsWith('.md')).sort()
      for (const file of domainFiles) {
        const raw = await fs.readFile(path.join(domainsDir, file), 'utf-8')
        domains.push({ name: path.basename(file, '.md'), content: stripFrontmatter(raw) })
      }
    } catch {
      // no domains dir
    }

    return { core, cognition, context, domains }
  }

  private renderPromptTemplate(template: string, meta: ProfileMeta): string {
    return template
      .replaceAll('{{profile_id}}', meta.id)
      .replaceAll('{{profile_name}}', meta.name)
      .replaceAll('{{profile_description}}', meta.description)
  }

  async loadBasePrompt(profileId: string): Promise<string> {
    const templatePath = path.join(this.profilesDir, '_shared/system/base_prompt.md')
    const [meta, raw] = await Promise.all([
      this.loadProfileMeta(profileId),
      fs.readFile(templatePath, 'utf-8'),
    ])
    return this.renderPromptTemplate(stripFrontmatter(raw), meta)
  }

  private async readDocuments(
    rootDir: string,
    currentDir: string,
    section: ProfileDocument['section'],
  ): Promise<ProfileDocument[]> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      const documents: ProfileDocument[] = []
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const entryPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          documents.push(...await this.readDocuments(rootDir, entryPath, section))
          continue
        }
        if (!entry.isFile() || !/\.(md|ya?ml)$/i.test(entry.name)) continue
        documents.push({
          path: path.relative(rootDir, entryPath),
          name: path.basename(entry.name, path.extname(entry.name)),
          section,
          format: entry.name.endsWith('.md') ? 'markdown' : 'yaml',
          content: await fs.readFile(entryPath, 'utf-8'),
        })
      }
      return documents
    } catch {
      return []
    }
  }

  async loadProfileDocuments(profileId: string): Promise<ProfileDocument[]> {
    const profileDir = this.profileDir(profileId)
    const [profile, system, knowledge] = await Promise.all([
      this.readDocuments(profileDir, path.join(profileDir, 'profile'), 'profile'),
      this.readDocuments(profileDir, path.join(profileDir, 'system'), 'system'),
      this.readDocuments(profileDir, path.join(profileDir, 'knowledge'), 'knowledge'),
    ])
    return [...profile, ...system, ...knowledge]
  }

  private async loadEntries(dir: string): Promise<Array<{ meta: EntryMeta; content: string }>> {
    try {
      const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md')).sort().reverse()
      const results = []
      for (const file of files) {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8')
        results.push(parseFrontmatter(raw))
      }
      return results
    } catch {
      return []
    }
  }

  async scoreKnowledge(profileId: string, domains: string[], query: string): Promise<KnowledgeMatch[]> {
    const knowledgeDir = path.join(this.profileDir(profileId), 'knowledge')
    const [entries, decisions] = await Promise.all([
      this.loadEntries(path.join(knowledgeDir, 'entries')),
      this.loadEntries(path.join(knowledgeDir, 'decisions')),
    ])

    const all = [...entries, ...decisions]
    if (all.length === 0) return []

    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return all
      .filter(e => {
        if (domains.length === 0) return true
        const entryDomains = e.meta.domain ?? []
        return domains.some(d => entryDomains.includes(d))
      })
      .map(e => {
        const tags = e.meta.tags ?? []
        const tagScore = tags.filter(t => queryTokens.some(q => t.toLowerCase().includes(q))).length
        return { content: e.content, score: tagScore }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  async retrieveKnowledge(profileId: string, domains: string[], query: string): Promise<string[]> {
    const scored = await this.scoreKnowledge(profileId, domains, query)
    return scored.map(e => e.content)
  }
}
