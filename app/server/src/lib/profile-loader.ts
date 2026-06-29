import fs from 'fs/promises'
import path from 'path'
import type { ProfileMeta } from '../types'

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

export async function listProfiles(profilesDir: string): Promise<ProfileMeta[]> {
  const entries = await fs.readdir(profilesDir, { withFileTypes: true })
  const profiles: ProfileMeta[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(profilesDir, entry.name, 'meta.yaml')
    try {
      const raw = await fs.readFile(metaPath, 'utf-8')
      const yamlStr = raw.includes('---')
        ? (raw.match(/^---\n([\s\S]*?)\n---/) ?? ['', ''])[1]
        : raw
      const data = parseSimpleYaml(yamlStr)
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

async function readMarkdownFiles(dir: string): Promise<string[]> {
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

export interface ProfileSections {
  core: string[]
  cognition: string[]
  context: string[]
  domains: Array<{ name: string; content: string }>
}

export async function loadProfileSections(profileDir: string): Promise<ProfileSections> {
  const [core, cognition, context] = await Promise.all([
    readMarkdownFiles(path.join(profileDir, 'profile/core')),
    readMarkdownFiles(path.join(profileDir, 'profile/cognition')),
    readMarkdownFiles(path.join(profileDir, 'profile/context')),
  ])

  const domainsDir = path.join(profileDir, 'profile/domains')
  const domains: Array<{ name: string; content: string }> = []
  try {
    const domainFiles = (await fs.readdir(domainsDir)).filter(f => f.endsWith('.md')).sort()
    for (const file of domainFiles) {
      const raw = await fs.readFile(path.join(domainsDir, file), 'utf-8')
      domains.push({ name: path.basename(file, '.md'), content: stripFrontmatter(raw) })
    }
  } catch { /* no domains dir */ }

  return { core, cognition, context, domains }
}

export async function loadBasePrompt(profileDir: string): Promise<string> {
  const raw = await fs.readFile(path.join(profileDir, 'system/base_prompt.md'), 'utf-8')
  return stripFrontmatter(raw)
}

export interface ProfileDocument {
  path: string
  name: string
  section: 'profile' | 'system' | 'knowledge'
  format: 'markdown' | 'yaml'
  content: string
}

async function readDocuments(
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
        documents.push(...await readDocuments(rootDir, entryPath, section))
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

export async function loadProfileDocuments(profileDir: string): Promise<ProfileDocument[]> {
  const [profile, system, knowledge] = await Promise.all([
    readDocuments(profileDir, path.join(profileDir, 'profile'), 'profile'),
    readDocuments(profileDir, path.join(profileDir, 'system'), 'system'),
    readDocuments(profileDir, path.join(profileDir, 'knowledge'), 'knowledge'),
  ])
  return [...profile, ...system, ...knowledge]
}
