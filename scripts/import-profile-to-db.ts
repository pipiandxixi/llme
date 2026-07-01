import fs from 'fs/promises'
import path from 'path'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'

const PROJECT_ROOT = process.cwd()
loadEnv({ path: path.join(PROJECT_ROOT, '.env') })

const PROFILES_DIR = process.env.PROFILES_DIR?.trim() || path.join(PROJECT_ROOT, 'profiles')
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

interface ParsedFrontmatter {
  meta: Record<string, string | string[]>
  body: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const profileIndex = args.findIndex((arg) => arg === '--profile')
  const profileId = profileIndex >= 0 ? args[profileIndex + 1] : null
  if (!profileId) {
    throw new Error('Usage: npm run import:profile -- --profile <profile-id>')
  }
  return { profileId }
}

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, '')
}

function parseArrayLiteral(value: string) {
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => stripQuotes(item))
    .filter(Boolean)
}

function parseSimpleYaml(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const ci = line.indexOf(':')
    if (ci <= 0) continue
    const key = line.slice(0, ci).trim()
    const value = stripQuotes(line.slice(ci + 1))
    result[key] = value
  }
  return result
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw.trim() }

  const meta: Record<string, string | string[]> = {}
  for (const line of match[1].split('\n')) {
    const ci = line.indexOf(':')
    if (ci <= 0) continue
    const key = line.slice(0, ci).trim()
    const value = line.slice(ci + 1).trim()
    meta[key] = value.startsWith('[') && value.endsWith(']')
      ? parseArrayLiteral(value)
      : stripQuotes(value)
  }

  return { meta, body: match[2].trim() }
}

function inferTitle(body: string, fallback: string) {
  const heading = body.split('\n').find((line) => /^#\s+/.test(line.trim()))
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback
}

async function upsertProfile(pool: Pool, profileId: string) {
  const raw = await fs.readFile(path.join(PROFILES_DIR, profileId, 'meta.yaml'), 'utf-8')
  const meta = parseSimpleYaml(raw)

  const result = await pool.query(
    `insert into public.profiles (slug, name, description, avatar_path, source_meta)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (slug) do update
       set name = excluded.name,
           description = excluded.description,
           avatar_path = excluded.avatar_path,
           source_meta = excluded.source_meta
     returning id`,
    [
      profileId,
      meta.name ?? profileId,
      meta.description ?? '',
      meta.avatar ?? null,
      JSON.stringify(meta),
    ],
  )

  return {
    id: result.rows[0].id as string,
    avatar: meta.avatar ?? null,
  }
}

async function importSections(pool: Pool, dbProfileId: string, profileId: string) {
  const profileRoot = path.join(PROFILES_DIR, profileId, 'profile')
  const sectionSpecs = [
    { dir: path.join(profileRoot, 'core'), layer: 'core' },
    { dir: path.join(profileRoot, 'cognition'), layer: 'cognition' },
    { dir: path.join(profileRoot, 'context'), layer: 'context' },
    { dir: path.join(profileRoot, 'domains'), layer: 'domain' },
  ] as const

  let count = 0
  for (const spec of sectionSpecs) {
    let files: string[] = []
    try {
      files = (await fs.readdir(spec.dir)).filter((file) => file.endsWith('.md')).sort()
    } catch {
      continue
    }

    for (const [index, file] of files.entries()) {
      const raw = await fs.readFile(path.join(spec.dir, file), 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      const sectionKey = path.basename(file, '.md')
      const title = inferTitle(body, sectionKey)

      await pool.query(
        `insert into public.profile_sections
           (profile_id, layer, section_key, title, body_md, stability, last_updated, source_path, position, metadata)
         values
           ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10::jsonb)
         on conflict (profile_id, layer, section_key) do update
           set title = excluded.title,
               body_md = excluded.body_md,
               stability = excluded.stability,
               last_updated = excluded.last_updated,
               source_path = excluded.source_path,
               position = excluded.position,
               metadata = excluded.metadata`,
        [
          dbProfileId,
          spec.layer,
          sectionKey,
          title,
          body,
          typeof meta.stability === 'string' ? meta.stability : null,
          typeof meta.last_updated === 'string' ? meta.last_updated : null,
          path.relative(path.join(PROFILES_DIR, profileId), path.join(spec.dir, file)),
          index,
          JSON.stringify(meta),
        ],
      )
      count += 1
    }
  }

  const systemAssembly = path.join(PROFILES_DIR, profileId, 'system', 'assembly.md')
  try {
    const raw = await fs.readFile(systemAssembly, 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    await pool.query(
      `insert into public.profile_sections
         (profile_id, layer, section_key, title, body_md, source_path, position, metadata)
       values
         ($1, 'system', 'assembly', $2, $3, $4, 0, $5::jsonb)
       on conflict (profile_id, layer, section_key) do update
         set title = excluded.title,
             body_md = excluded.body_md,
             source_path = excluded.source_path,
             metadata = excluded.metadata`,
      [
        dbProfileId,
        inferTitle(body, 'assembly'),
        body,
        'system/assembly.md',
        JSON.stringify(meta),
      ],
    )
    count += 1
  } catch {
    // optional
  }

  return count
}

async function importMemoryDir(
  pool: Pool,
  dbProfileId: string,
  profileId: string,
  kind: 'entry' | 'decision',
  dirName: 'entries' | 'decisions',
) {
  const dir = path.join(PROFILES_DIR, profileId, 'knowledge', dirName)
  let files: string[] = []
  try {
    files = (await fs.readdir(dir)).filter((file) => file.endsWith('.md')).sort()
  } catch {
    return 0
  }

  for (const file of files) {
    const raw = await fs.readFile(path.join(dir, file), 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    const slug = path.basename(file, '.md')
    const title = inferTitle(body, slug)

    await pool.query(
      `insert into public.memory_items
         (profile_id, kind, external_id, slug, title, body_md, happened_on, memory_type, domains, tags, confidence, outcome, source_label, related_sections, source_path, metadata)
       values
         ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::text[], $10::text[], $11, $12, $13, $14::text[], $15, $16::jsonb)
       on conflict (profile_id, kind, slug) do update
         set external_id = excluded.external_id,
             title = excluded.title,
             body_md = excluded.body_md,
             happened_on = excluded.happened_on,
             memory_type = excluded.memory_type,
             domains = excluded.domains,
             tags = excluded.tags,
             confidence = excluded.confidence,
             outcome = excluded.outcome,
             source_label = excluded.source_label,
             related_sections = excluded.related_sections,
             source_path = excluded.source_path,
             metadata = excluded.metadata`,
      [
        dbProfileId,
        kind,
        typeof meta.id === 'string' ? meta.id : null,
        slug,
        title,
        body,
        typeof meta.date === 'string' ? meta.date : null,
        typeof meta.type === 'string' ? meta.type : null,
        Array.isArray(meta.domain) ? meta.domain : [],
        Array.isArray(meta.tags) ? meta.tags : [],
        typeof meta.confidence === 'string' ? meta.confidence : null,
        typeof meta.outcome === 'string' ? meta.outcome : null,
        typeof meta.source === 'string' ? meta.source : null,
        Array.isArray(meta.related_profile) ? meta.related_profile : [],
        path.relative(path.join(PROFILES_DIR, profileId), path.join(dir, file)),
        JSON.stringify(meta),
      ],
    )
  }

  return files.length
}

async function upsertAvatarAsset(pool: Pool, dbProfileId: string, avatarPath: string | null) {
  if (!avatarPath) return

  await pool.query(
    `delete from public.profile_assets
     where profile_id = $1 and asset_type = 'avatar' and storage_provider = 'external' and object_path = $2`,
    [dbProfileId, avatarPath],
  )

  await pool.query(
    `insert into public.profile_assets
       (profile_id, asset_type, storage_provider, object_path, metadata)
     values
       ($1, 'avatar', 'external', $2, $3::jsonb)`,
    [
      dbProfileId,
      avatarPath,
      JSON.stringify({ imported_from_repo: true }),
    ],
  )
}

async function main() {
  const { profileId } = parseArgs()
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await fs.access(path.join(PROFILES_DIR, profileId))

    const { id: dbProfileId, avatar } = await upsertProfile(pool, profileId)
    const sectionCount = await importSections(pool, dbProfileId, profileId)
    const entryCount = await importMemoryDir(pool, dbProfileId, profileId, 'entry', 'entries')
    const decisionCount = await importMemoryDir(pool, dbProfileId, profileId, 'decision', 'decisions')
    await upsertAvatarAsset(pool, dbProfileId, avatar)

    const summary = await pool.query(
      `select
         (select count(*) from public.profile_sections where profile_id = $1) as section_count,
         (select count(*) from public.memory_items where profile_id = $1 and kind = 'entry') as entry_count,
         (select count(*) from public.memory_items where profile_id = $1 and kind = 'decision') as decision_count`,
      [dbProfileId],
    )

    console.log(JSON.stringify({
      profileId,
      imported: {
        sections: sectionCount,
        entries: entryCount,
        decisions: decisionCount,
      },
      totalsInDb: summary.rows[0],
    }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
