import { useState, useRef, useEffect, useCallback } from 'react'
import { getProfileAvatarUrl, streamChat } from '../api'
import type { ProfileMeta, Message, Topic } from '../types'
import MessageBubble from '../components/MessageBubble'
import ProfileAvatar from '../components/ProfileAvatar'

function Icon({ name, size = 18 }: { name: 'menu' | 'plus' | 'chevron' | 'chat' | 'send' | 'sparkles'; size?: number }) {
  const paths = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
    send: <><path d="m5 12 7-7 7 7M12 5v14" /></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3zM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

interface Props {
  profiles: ProfileMeta[]
  profile: ProfileMeta
  topics: Topic[]
  activeTopic: Topic
  onSelectTopic: (id: string) => void
  onNewTopic: (profileId: string) => void
  onMessagesChange: (messages: Message[]) => void
  onOpenAdmin: () => void
}

export default function Chat({ profiles, profile, topics, activeTopic, onSelectTopic, onNewTopic, onMessagesChange, onOpenAdmin }: Props) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(() => new Set([profile.id]))
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<Message[]>(activeTopic.messages)
  const messages = activeTopic.messages

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setExpandedProfiles((current) => new Set(current).add(profile.id))
    setInput('')
    messagesRef.current = activeTopic.messages
  }, [profile.id, activeTopic.id])

  const setMessages = (value: Message[] | ((current: Message[]) => Message[])) => {
    const next = typeof value === 'function' ? value(messagesRef.current) : value
    messagesRef.current = next
    onMessagesChange(next)
  }

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      for await (const chunk of streamChat(profile.id, newMessages)) {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      }
    } catch (err) {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        return [...prev.slice(0, -1), { ...last, content: last.content || '（响应出错，请重试）' }]
      })
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, isStreaming, messages, profile.id, activeTopic.id])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      send()
    }
  }

  const avatarUrl = getProfileAvatarUrl(profile)
  const toggleProfile = (profileId: string) => {
    setExpandedProfiles((current) => {
      const next = new Set(current)
      next.has(profileId) ? next.delete(profileId) : next.add(profileId)
      return next
    })
  }

  return (
    <div className="h-full bg-white flex text-[#0d0d0d] overflow-hidden">
      {sidebarOpen && <button aria-label="关闭侧边栏" className="fixed inset-0 bg-black/25 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 h-full w-[280px] shrink-0 bg-[#f9f9f9] border-r border-black/[0.06] flex flex-col transition-transform duration-200`}>
        <div className="px-3 pt-3 pb-2">
          <div className="h-10 flex items-center justify-between px-2">
            <div className="font-semibold tracking-[-0.02em] text-[19px]">llme</div>
            <button className="icon-button" title="新建对话" onClick={() => onNewTopic(profile.id)}><Icon name="plus" /></button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <div className="px-2 mt-3 mb-2 text-[11px] font-medium tracking-wide uppercase text-[#8a8a8a]">数字人</div>
          {profiles.map((item) => {
            const expanded = expandedProfiles.has(item.id)
            const itemTopics = topics.filter((topic) => topic.profileId === item.id).sort((a, b) => b.updatedAt - a.updatedAt)
            return (
              <div key={item.id} className="mb-1">
                <div className={`group flex items-center rounded-lg ${item.id === profile.id ? 'bg-[#ececec]' : 'hover:bg-[#f0f0f0]'}`}>
                  <button onClick={() => toggleProfile(item.id)} className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-2 text-left">
                    <ProfileAvatar name={item.name} src={getProfileAvatarUrl(item)} sizeClassName="avatar-sm" initialClassName="" />
                    <span className="truncate text-sm font-medium">{item.name}</span>
                  </button>
                  <button onClick={() => toggleProfile(item.id)} className={`mr-2 text-[#777] transition-transform ${expanded ? 'rotate-90' : ''}`}><Icon name="chevron" size={15} /></button>
                </div>
                {expanded && (
                  <div className="ml-4 pl-3 border-l border-black/10 mt-1 space-y-0.5">
                    {itemTopics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => { onSelectTopic(topic.id); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${topic.id === activeTopic.id ? 'bg-[#e7e7e7] text-black' : 'text-[#5f5f5f] hover:bg-[#eeeeee] hover:text-black'}`}
                      >
                        <Icon name="chat" size={15} />
                        <span className="truncate">{topic.title}</span>
                      </button>
                    ))}
                    <button onClick={() => onNewTopic(item.id)} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[#777] hover:bg-[#eeeeee] hover:text-black">
                      <Icon name="plus" size={15} /><span>新建 Topic</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="p-3 border-t border-black/[0.06]">
          <button onClick={onOpenAdmin} className="w-full rounded-lg px-2.5 py-2.5 text-left hover:bg-[#ececec]">
            <div className="text-sm font-medium">资料库</div>
            <div className="text-[11px] text-[#888] mt-0.5">查看画像与记忆</div>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col bg-white">
        <header className="h-14 shrink-0 flex items-center px-3 md:px-5 border-b border-black/[0.06]">
          <button className="icon-button md:hidden mr-2" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{profile.name}</span><span className="text-[#aaa] font-normal">/</span><span className="truncate font-normal text-[#555]">{activeTopic.title}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center px-6 pb-24">
              <div className="text-center max-w-xl">
                <ProfileAvatar name={profile.name} src={avatarUrl} sizeClassName="avatar-lg mx-auto mb-5" initialClassName="" />
                <h1 className="text-2xl md:text-[28px] font-semibold tracking-[-0.03em]">和 {profile.name} 对话</h1>
                <p className="mt-3 text-sm leading-6 text-[#6f6f6f]">{profile.description}</p>
                <div className="mt-7 inline-flex items-center gap-2 text-xs text-[#8a8a8a]"><Icon name="sparkles" size={15} />基于画像与知识库回答</div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto px-5 py-8 md:py-10 space-y-7">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} profileName={profile.name} profileAvatarUrl={avatarUrl} profileInitial={profile.name.charAt(0).toUpperCase()} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 bg-gradient-to-t from-white via-white to-white/0 px-4 pb-3 pt-4">
          <div className="max-w-3xl mx-auto">
            <div className="composer flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
                placeholder={`给 ${profile.name} 发消息（Ctrl + Enter 发送）`}
                className="flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none placeholder:text-[#9b9b9b] disabled:opacity-50 max-h-40 overflow-y-auto"
                style={{ minHeight: '44px' }}
              />
              <button onClick={send} disabled={isStreaming || !input.trim()} className="mb-1.5 mr-1 send-button" title="发送"><Icon name="send" size={18} /></button>
            </div>
            <div className="text-center text-[11px] text-[#999] mt-2">数字人可能会产生不准确的信息，请核实重要内容。</div>
          </div>
        </div>
      </main>
    </div>
  )
}
