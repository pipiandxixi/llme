import fs from 'fs/promises'
import path from 'path'

const webDir = process.cwd()
const projectRoot = path.resolve(webDir, '../..')
const profilesDir = path.join(projectRoot, 'profiles')
const publicProfilesDir = path.join(webDir, 'public', 'profiles')

async function removeDir(target) {
  await fs.rm(target, { recursive: true, force: true })
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true })
}

async function syncProfileAssets() {
  await removeDir(publicProfilesDir)
  await ensureDir(publicProfilesDir)

  const entries = await fs.readdir(profilesDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const sourceAssetsDir = path.join(profilesDir, entry.name, 'assets')
    const targetAssetsDir = path.join(publicProfilesDir, entry.name, 'assets')

    try {
      await fs.access(sourceAssetsDir)
      await ensureDir(path.dirname(targetAssetsDir))
      await fs.cp(sourceAssetsDir, targetAssetsDir, { recursive: true })
    } catch {
      // Profiles without assets are allowed.
    }
  }
}

await syncProfileAssets()
