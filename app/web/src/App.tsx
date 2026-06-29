import { useState, useEffect, useMemo } from 'react'
import { getProfiles } from './api'
import type { Message, ProfileMeta, Topic } from './types'
import Chat from './pages/Chat'
import Admin from './pages/Admin'
import Login from './pages/Login'

const STORAGE_KEY = 'llme.topics.v1'
const AUTH_STORAGE_KEY = 'llme.auth.v1'

function loadTopics(): Topic[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function createTopic(profileId: string): Topic {
  return {
    id: crypto.randomUUID(),
    profileId,
    title: '新对话',
    messages: [],
    updatedAt: Date.now(),
  }
}

function loadAuthState(): boolean {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function App() {
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [topics, setTopics] = useState<Topic[]>(loadTopics)
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [authenticated, setAuthenticated] = useState(loadAuthState)

  useEffect(() => {
    getProfiles()
      .then((items) => {
        setLoadError('')
        setProfiles(items)
        if (items.length > 0) {
          setTopics((current) => {
            if (current.length > 0) {
              setActiveTopicId(current[0].id)
              return current
            }
            const initial = createTopic(items[0].id)
            setActiveTopicId(initial.id)
            return [initial]
          })
        }
      })
      .catch((err) => {
        console.error(err)
        setLoadError('数字人列表加载失败，请检查服务端部署和环境变量。')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics))
  }, [topics])

  useEffect(() => {
    localStorage.setItem(AUTH_STORAGE_KEY, authenticated ? 'true' : 'false')
  }, [authenticated])

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) ?? null,
    [topics, activeTopicId],
  )
  const activeProfile = profiles.find((profile) => profile.id === activeTopic?.profileId) ?? profiles[0]

  const addTopic = (profileId: string) => {
    const topic = createTopic(profileId)
    setTopics((current) => [topic, ...current])
    setActiveTopicId(topic.id)
  }

  const deleteTopic = (topicId: string) => {
    setTopics((current) => {
      const next = current.filter((topic) => topic.id !== topicId)

      if (activeTopicId === topicId) {
        setActiveTopicId(next[0]?.id ?? null)
      }

      return next
    })
  }

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />
  }

  const updateMessages = (topicId: string, messages: Message[]) => {
    setTopics((current) =>
      current.map((topic) => {
        if (topic.id !== topicId) return topic
        const firstQuestion = messages.find((message) => message.role === 'user')?.content.trim()
        return {
          ...topic,
          messages,
          title: topic.title === '新对话' && firstQuestion
            ? firstQuestion.replace(/\s+/g, ' ').slice(0, 28)
            : topic.title,
          updatedAt: Date.now(),
        }
      }),
    )
  }

  if (loading) {
    return (
      <div className="h-full bg-[#f7f7f8] flex items-center justify-center">
        <div className="text-[#6b6b6b] text-sm">正在加载数字人...</div>
      </div>
    )
  }

  if (!activeProfile || !activeTopic) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[#6b6b6b]">
        {loadError || '当前没有会话，点击左上角加号新建对话。'}
      </div>
    )
  }

  if (adminOpen) {
    return <Admin profiles={profiles} initialProfileId={activeProfile.id} onClose={() => setAdminOpen(false)} />
  }

  return (
    <Chat
      profiles={profiles}
      profile={activeProfile}
      topics={topics}
      activeTopic={activeTopic}
      onSelectTopic={setActiveTopicId}
      onNewTopic={addTopic}
      onDeleteTopic={deleteTopic}
      onMessagesChange={(messages) => updateMessages(activeTopic.id, messages)}
      onOpenAdmin={() => setAdminOpen(true)}
    />
  )
}
