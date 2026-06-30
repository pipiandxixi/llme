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
