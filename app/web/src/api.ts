import type {
  ProfileMeta,
  Message,
  ProfileDocuments,
  WebSearchMode,
  ProfileLayer,
  MemoryKind,
  ProfileSectionRecord,
  MemoryItemRecord,
  RawMaterial,
  ContentProposal,
} from './types'

export function getProfileAvatarUrl(profile: ProfileMeta): string | undefined {
  if (!profile.avatar) return undefined
  if (/^https?:\/\//i.test(profile.avatar)) return profile.avatar
  return `/profiles/${encodeURIComponent(profile.id)}/${profile.avatar.replace(/^\/+/, '')}`
}

export async function getProfiles(): Promise<ProfileMeta[]> {
  const res = await fetch('/api/profiles')
  if (!res.ok) throw new Error('Failed to fetch profiles')
  return res.json()
}

export async function getProfileDocuments(profileId: string): Promise<ProfileDocuments> {
  const res = await fetch(`/api/profile/documents?id=${encodeURIComponent(profileId)}`)
  if (!res.ok) throw new Error('Failed to fetch profile documents')
  return res.json()
}

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function getAdminSections(profileId: string): Promise<ProfileSectionRecord[]> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/sections`)
}

export function updateAdminSection(
  profileId: string,
  layer: ProfileLayer,
  sectionKey: string,
  content: string,
): Promise<{ ok: true }> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/sections/${layer}/${encodeURIComponent(sectionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export function getAdminMemory(profileId: string): Promise<MemoryItemRecord[]> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/memory`)
}

export interface MemoryUpdatePayload {
  content: string
  domains: string[]
  tags: string[]
  memoryType: string | null
  confidence: string | null
  outcome: string | null
  sourceLabel: string | null
}

export function updateAdminMemory(
  profileId: string,
  kind: MemoryKind,
  slug: string,
  payload: MemoryUpdatePayload,
): Promise<{ ok: true }> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/memory/${kind}/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getRawMaterials(profileId: string): Promise<RawMaterial[]> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/raw-materials`)
}

export function submitRawMaterial(
  profileId: string,
  input: { title?: string; content: string; sourceLabel?: string },
): Promise<{ id: string; slug: string }> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/raw-materials`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function analyzeRawMaterial(profileId: string, rawMaterialId: string): Promise<ContentProposal[]> {
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/raw-materials/${rawMaterialId}/analyze`, {
    method: 'POST',
  })
}

export function getProposals(profileId: string, status?: string): Promise<ContentProposal[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return adminRequest(`/profiles/${encodeURIComponent(profileId)}/proposals${query}`)
}

export function decideProposal(proposalId: string, decision: 'approve' | 'reject'): Promise<ContentProposal> {
  return adminRequest(`/proposals/${proposalId}/${decision}`, { method: 'POST' })
}

export async function* streamChat(
  profileId: string,
  messages: Message[],
  webSearchMode: WebSearchMode = 'auto'
): AsyncGenerator<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, messages, webSearchMode }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await res.json() as { content?: string; error?: string }
    if (payload.error) throw new Error(payload.error)
    if (payload.content) yield payload.content
    return
  }

  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]' || data === '[ERROR]') return
      if (data) yield data
    }
  }
}
