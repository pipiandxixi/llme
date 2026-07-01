import { Hono } from 'hono'
import {
  AdminModeError,
  listProfileSectionsForEdit,
  listMemoryItemsForEdit,
  updateProfileSection,
  updateMemoryItem,
  submitRawMaterial,
  listRawMaterials,
  analyzeRawMaterial,
  listProposals,
  decideProposal,
  type ProfileLayer,
  type MemoryKind,
} from '../lib/admin-store'

const app = new Hono()

function validateProfileId(profileId: string | undefined): profileId is string {
  return !!profileId && /^[a-zA-Z0-9_-]+$/.test(profileId)
}

function handleError(err: unknown): [{ error: string }, 400 | 404 | 409 | 500 | 501] {
  if (err instanceof AdminModeError) return [{ error: err.message }, 501]
  const message = err instanceof Error ? err.message : 'Unknown error'
  if (/not found/i.test(message)) return [{ error: message }, 404]
  if (/already decided/i.test(message)) return [{ error: message }, 409]
  return [{ error: message }, 500]
}

app.get('/profiles/:id/sections', async (c) => {
  const profileId = c.req.param('id')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  try {
    return c.json(await listProfileSectionsForEdit(profileId))
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

app.put('/profiles/:id/sections/:layer/:sectionKey', async (c) => {
  const profileId = c.req.param('id')
  const layer = c.req.param('layer') as ProfileLayer
  const sectionKey = c.req.param('sectionKey')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  if (!['core', 'cognition', 'context', 'domain'].includes(layer)) {
    return c.json({ error: 'Invalid layer' }, 400)
  }

  const body = await c.req.json<{ content?: string }>()
  if (typeof body.content !== 'string') return c.json({ error: 'content is required' }, 400)

  try {
    await updateProfileSection(profileId, layer, sectionKey, body.content)
    return c.json({ ok: true })
  } catch (err) {
    const [errBody, status] = handleError(err)
    return c.json(errBody, status)
  }
})

app.get('/profiles/:id/memory', async (c) => {
  const profileId = c.req.param('id')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  try {
    return c.json(await listMemoryItemsForEdit(profileId))
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

app.put('/profiles/:id/memory/:kind/:slug', async (c) => {
  const profileId = c.req.param('id')
  const kind = c.req.param('kind') as MemoryKind
  const slug = c.req.param('slug')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  if (!['entry', 'decision'].includes(kind)) return c.json({ error: 'Invalid kind' }, 400)

  const body = await c.req.json<{
    content?: string
    domains?: string[]
    tags?: string[]
    memoryType?: string | null
    confidence?: string | null
    outcome?: string | null
    sourceLabel?: string | null
  }>()
  if (typeof body.content !== 'string') return c.json({ error: 'content is required' }, 400)

  try {
    await updateMemoryItem(profileId, kind, slug, {
      bodyMd: body.content,
      domains: Array.isArray(body.domains) ? body.domains : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      memoryType: body.memoryType ?? null,
      confidence: body.confidence ?? null,
      outcome: body.outcome ?? null,
      sourceLabel: body.sourceLabel ?? null,
    })
    return c.json({ ok: true })
  } catch (err) {
    const [errBody, status] = handleError(err)
    return c.json(errBody, status)
  }
})

app.get('/profiles/:id/raw-materials', async (c) => {
  const profileId = c.req.param('id')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  try {
    return c.json(await listRawMaterials(profileId))
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

app.post('/profiles/:id/raw-materials', async (c) => {
  const profileId = c.req.param('id')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  const body = await c.req.json<{ title?: string; content?: string; sourceLabel?: string }>()
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return c.json({ error: 'content is required' }, 400)
  }

  try {
    const result = await submitRawMaterial(profileId, {
      title: body.title,
      bodyMd: body.content,
      sourceLabel: body.sourceLabel,
    })
    return c.json(result, 201)
  } catch (err) {
    const [errBody, status] = handleError(err)
    return c.json(errBody, status)
  }
})

app.post('/profiles/:id/raw-materials/:rawId/analyze', async (c) => {
  const profileId = c.req.param('id')
  const rawId = c.req.param('rawId')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  try {
    const proposals = await analyzeRawMaterial(profileId, rawId)
    return c.json(proposals)
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

app.get('/profiles/:id/proposals', async (c) => {
  const profileId = c.req.param('id')
  if (!validateProfileId(profileId)) return c.json({ error: 'Invalid profile id' }, 400)
  const status = c.req.query('status')
  try {
    return c.json(await listProposals(profileId, status))
  } catch (err) {
    const [body, statusCode] = handleError(err)
    return c.json(body, statusCode)
  }
})

app.post('/proposals/:id/approve', async (c) => {
  const proposalId = c.req.param('id')
  try {
    return c.json(await decideProposal(proposalId, 'approve'))
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

app.post('/proposals/:id/reject', async (c) => {
  const proposalId = c.req.param('id')
  try {
    return c.json(await decideProposal(proposalId, 'reject'))
  } catch (err) {
    const [body, status] = handleError(err)
    return c.json(body, status)
  }
})

export default app
