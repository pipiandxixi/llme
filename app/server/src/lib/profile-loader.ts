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

async function readProfileMetaFile(profileDir: string): Promise<Record<string, string>> {
  const raw = await fs.readFile(path.join(profileDir, 'meta.yaml'), 'utf-8')
  const yamlStr = raw.includes('---')
    ? (raw.match(/^---\n([\s\S]*?)\n---/) ?? ['', ''])[1]
    : raw
  return parseSimpleYaml(yamlStr)
}

export async function listProfiles(profilesDir: string): Promise<ProfileMeta[]> {
  const entries = await fs.readdir(profilesDir, { withFileTypes: true })
  const profiles: ProfileMeta[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(profilesDir, entry.name, 'meta.yaml')
    try {
      await fs.access(metaPath)
      const data = await readProfileMetaFile(path.join(profilesDir, entry.name))
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

export async function loadProfileMeta(profileDir: string): Promise<ProfileMeta> {
  const data = await readProfileMetaFile(profileDir)
  return {
    id: path.basename(profileDir),
    name: data.name ?? path.basename(profileDir),
    description: data.description ?? '',
    avatar: data.avatar?.trim() || undefined,
  }
}

function renderPromptTemplate(template: string, meta: ProfileMeta): string {
  return template
    .replaceAll('{{profile_id}}', meta.id)
    .replaceAll('{{profile_name}}', meta.name)
    .replaceAll('{{profile_description}}', meta.description)
}

export async function loadBasePrompt(profileDir: string): Promise<string> {
  const templatePath = path.join(path.dirname(profileDir), '_shared/system/base_prompt.md')
  const [meta, raw] = await Promise.all([
    loadProfileMeta(profileDir),
    fs.readFile(templatePath, 'utf-8'),
  ])
  return renderPromptTemplate(stripFrontmatter(raw), meta)
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
