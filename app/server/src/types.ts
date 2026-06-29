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

export interface ChatRequest {
  profileId: string
  messages: Message[]
}
