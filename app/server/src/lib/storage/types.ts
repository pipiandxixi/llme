import type { ProfileMeta } from '../../types'

export interface DomainSection {
  name: string
  content: string
}

export interface ProfileSections {
  core: string[]
  cognition: string[]
  context: string[]
  domains: DomainSection[]
}

export interface ProfileDocument {
  path: string
  name: string
  section: 'profile' | 'system' | 'knowledge'
  format: 'markdown' | 'yaml'
  content: string
}

export interface KnowledgeMatch {
  content: string
  score: number
}

export interface ContentStore {
  listProfiles(): Promise<ProfileMeta[]>
  loadProfileMeta(profileId: string): Promise<ProfileMeta>
  loadProfileSections(profileId: string): Promise<ProfileSections>
  loadBasePrompt(profileId: string): Promise<string>
  loadProfileDocuments(profileId: string): Promise<ProfileDocument[]>
  scoreKnowledge(profileId: string, domains: string[], query: string): Promise<KnowledgeMatch[]>
  retrieveKnowledge(profileId: string, domains: string[], query: string): Promise<string[]>
}
