import { PROFILES_DIR } from '../../config'
import { FileContentStore } from './file-store'
import { PostgresContentStore } from './postgres-store'
import type { ContentStore } from './types'

let store: ContentStore | null = null

function resolveDriver() {
  const driver = (process.env.LLME_CONTENT_STORE || 'file').trim().toLowerCase()
  return driver === 'postgres' ? 'postgres' : 'file'
}

export function getContentStore(): ContentStore {
  if (store) return store
  store = resolveDriver() === 'postgres'
    ? new PostgresContentStore()
    : new FileContentStore(PROFILES_DIR)
  return store
}

export type { ContentStore, KnowledgeMatch, ProfileDocument, ProfileSections } from './types'
