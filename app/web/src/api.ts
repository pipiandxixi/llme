import type { ProfileMeta, Message, ProfileDocuments } from './types'

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

export async function* streamChat(
  profileId: string,
  messages: Message[]
): AsyncGenerator<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, messages }),
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
