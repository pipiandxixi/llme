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

export interface ChatRequest {
  profileId: string
  messages: Message[]
  webSearchMode?: WebSearchMode
}
