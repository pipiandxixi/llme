import fs from 'fs/promises'
import path from 'path'

interface EntryMeta {
  domain?: string[]
  tags?: string[]
  date?: string
  type?: string
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

async function loadEntries(dir: string): Promise<Array<{ meta: EntryMeta; content: string }>> {
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

export interface KnowledgeMatch {
  content: string
  score: number
}

export async function scoreKnowledge(
  knowledgeDir: string,
  domains: string[],
  query: string
): Promise<KnowledgeMatch[]> {
  const [entries, decisions] = await Promise.all([
    loadEntries(path.join(knowledgeDir, 'entries')),
    loadEntries(path.join(knowledgeDir, 'decisions')),
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

export async function retrieveKnowledge(
  knowledgeDir: string,
  domains: string[],
  query: string
): Promise<string[]> {
  const scored = await scoreKnowledge(knowledgeDir, domains, query)
  return scored.map(e => e.content)
}
