import { Context, Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import { listProfiles, loadProfileDocuments } from '../lib/profile-loader'
import { PROFILES_DIR } from '../config'

const app = new Hono()

function validateProfileId(profileId: string | undefined) {
  return !!profileId && /^[a-zA-Z0-9_-]+$/.test(profileId)
}

function getProfileId(c: Context) {
  const profileId = c.req.query('id')
  return validateProfileId(profileId) ? profileId : null
}

app.get('/documents', async (c) => {
  const safeProfileId = getProfileId(c)
  if (!safeProfileId) {
    return c.json({ error: 'Invalid profile id' }, 400)
  }

  const profiles = await listProfiles(PROFILES_DIR)
  const profile = profiles.find((item) => item.id === safeProfileId)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)

  const documents = await loadProfileDocuments(path.join(PROFILES_DIR, safeProfileId))
  return c.json({ profile, documents })
})

app.get('/avatar', async (c) => {
  const safeProfileId = getProfileId(c)
  if (!safeProfileId) {
    return c.json({ error: 'Invalid profile id' }, 400)
  }

  const profiles = await listProfiles(PROFILES_DIR)
  const profile = profiles.find((item) => item.id === safeProfileId)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  if (!profile.avatar) return c.json({ error: 'Avatar not configured' }, 404)

  const avatarPath = path.join(PROFILES_DIR, safeProfileId, profile.avatar)
  try {
    const data = await fs.readFile(avatarPath)
    const ext = path.extname(avatarPath).toLowerCase()
    const contentType =
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      ext === '.gif' ? 'image/gif' :
      'image/jpeg'

    return new Response(data, {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
      },
    })
  } catch {
    return c.json({ error: 'Avatar file not found' }, 404)
  }
})

export default app
