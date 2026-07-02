export interface ProfileMeta {
  id: string
  name: string
  description: string
  avatar?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type WebSearchMode = 'off' | 'auto'

export interface Topic {
  id: string
  profileId: string
  title: string
  messages: Message[]
  updatedAt: number
}

export interface ProfileDocument {
  path: string
  name: string
  section: 'profile' | 'system' | 'knowledge'
  format: 'markdown' | 'yaml'
  content: string
}

export interface ProfileDocuments {
  profile: ProfileMeta
  documents: ProfileDocument[]
}

export type ProfileLayer = 'core' | 'cognition' | 'context' | 'domain'
export type MemoryKind = 'entry' | 'decision'

export interface ProfileSectionRecord {
  layer: ProfileLayer
  sectionKey: string
  title: string | null
  bodyMd: string
  stability: 'high' | 'medium' | 'low' | null
  lastUpdated: string | null
}

export interface MemoryItemRecord {
  kind: MemoryKind
  slug: string
  title: string | null
  bodyMd: string
  happenedOn: string | null
  domains: string[]
  tags: string[]
  memoryType: string | null
  confidence: 'high' | 'medium' | 'low' | null
  outcome: 'pending' | 'validated' | 'invalidated' | null
  sourceLabel: string | null
}

export interface RawMaterial {
  id: string
  slug: string
  title: string | null
  bodyMd: string
  sourceLabel: string | null
  processingStatus: string
  createdAt: string
}

export interface MemoryGraphConcept {
  slug: string
  title: string
  tags: string[]
  domains: string[]
}

export interface MemoryGraphMemory {
  kind: MemoryKind
  slug: string
  title: string
  linked: boolean
}

export interface MemoryGraphEdge {
  conceptSlug: string
  memoryKind: MemoryKind
  memorySlug: string
}

export interface MemoryGraphData {
  concepts: MemoryGraphConcept[]
  memories: MemoryGraphMemory[]
  edges: MemoryGraphEdge[]
}

export interface ContentProposal {
  id: string
  targetType: 'memory_item' | 'profile_section'
  action: 'create' | 'update'
  layer: ProfileLayer | null
  sectionKey: string | null
  memoryKind: MemoryKind | null
  slug: string | null
  title: string | null
  proposedBodyMd: string
  proposedMetadata: { domains?: string[]; tags?: string[]; confidence?: string | null; sourceLabel?: string | null }
  previousBodyMd: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}
