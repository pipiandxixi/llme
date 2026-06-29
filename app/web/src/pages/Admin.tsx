import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getProfileAvatarUrl, getProfileDocuments } from '../api'
import type { ProfileDocument, ProfileDocuments, ProfileMeta } from '../types'
import ProfileAvatar from '../components/ProfileAvatar'

type Section = ProfileDocument['section']

const SECTIONS: Array<{ id: Section; label: string; description: string }> = [
  { id: 'profile', label: '画像', description: '价值观、认知方式、领域判断与当前情境' },
  { id: 'system', label: '系统提示', description: '回答时使用的基础提示词与组装规则' },
  { id: 'knowledge', label: '记忆', description: '知识条目、决策记录与检索索引' },
]

function ArrowLeft() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
}

function FileIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
}

function Chevron() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
}

interface Props {
  profiles: ProfileMeta[]
  initialProfileId: string
  onClose: () => void
}

export default function Admin({ profiles, initialProfileId, onClose }: Props) {
  const [profileId, setProfileId] = useState(initialProfileId)
  const [section, setSection] = useState<Section>('profile')
  const [data, setData] = useState<ProfileDocuments | null>(null)
  const [selectedPath, setSelectedPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(() => new Set([initialProfileId]))

  useEffect(() => {
    setLoading(true)
    setError('')
    getProfileDocuments(profileId)
      .then((result) => {
        setData(result)
        setSelectedPath(result.documents.find((doc) => doc.section === section)?.path ?? '')
      })
      .catch(() => setError('无法加载该数字人的资料'))
      .finally(() => setLoading(false))
  }, [profileId])

  const documents = useMemo(
    () => data?.documents.filter((doc) => doc.section === section) ?? [],
    [data, section],
  )
  const selected = data?.documents.find((doc) => doc.path === selectedPath)

  const changeSection = (next: Section) => {
    setSection(next)
    setSelectedPath(data?.documents.find((doc) => doc.section === next)?.path ?? '')
  }

  const selectProfileSection = (nextProfileId: string, nextSection: Section) => {
    setExpandedProfiles((current) => new Set(current).add(nextProfileId))
    setSection(nextSection)
    if (nextProfileId === profileId) {
      setSelectedPath(data?.documents.find((doc) => doc.section === nextSection)?.path ?? '')
    } else {
      setProfileId(nextProfileId)
    }
  }

  const toggleProfile = (id: string) => {
    setExpandedProfiles((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="h-full bg-[#f7f7f8] flex flex-col text-[#151515]">
      <header className="h-16 shrink-0 bg-white border-b border-black/[0.07] px-4 md:px-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="icon-button" onClick={onClose} title="返回对话"><ArrowLeft /></button>
          <div>
            <div className="font-semibold tracking-[-0.02em]">数字人资料库</div>
            <div className="text-[11px] text-[#888]">只读管理视图</div>
          </div>
        </div>
        <select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="admin-select md:hidden">
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-[280px] shrink-0 border-r border-black/[0.07] bg-white p-3 hidden md:block overflow-y-auto">
          <div className="px-2 pt-2 pb-3 text-[11px] font-medium tracking-wide uppercase text-[#999]">数字人</div>
          {profiles.map((profile) => {
            const expanded = expandedProfiles.has(profile.id)
            const active = profile.id === profileId
            return (
              <div key={profile.id} className="mb-1">
                <button onClick={() => toggleProfile(profile.id)} className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left ${active ? 'bg-[#ececec]' : 'hover:bg-[#f4f4f4]'}`}>
                  <ProfileAvatar name={profile.name} src={getProfileAvatarUrl(profile)} sizeClassName="avatar-sm shrink-0" initialClassName="" />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{profile.name}</span>
                  <span className={`text-[#777] transition-transform ${expanded ? 'rotate-90' : ''}`}><Chevron /></span>
                </button>
                {expanded && (
                  <div className="ml-4 mt-1 pl-3 border-l border-black/10 space-y-0.5">
                    {SECTIONS.map((item) => {
                      const selectedSection = active && section === item.id
                      const count = active ? data?.documents.filter((doc) => doc.section === item.id).length : undefined
                      return (
                        <button key={item.id} onClick={() => selectProfileSection(profile.id, item.id)} className={`w-full rounded-lg px-2.5 py-2 text-left ${selectedSection ? 'bg-[#e7e7e7]' : 'hover:bg-[#f1f1f1]'}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${selectedSection ? 'font-medium text-black' : 'text-[#555]'}`}>{item.label}</span>
                            {count !== undefined && <span className="text-[11px] text-[#999]">{count}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <div className="md:hidden shrink-0 flex gap-1 p-2 bg-white border-b border-black/[0.07]">
            {SECTIONS.map((item) => (
              <button key={item.id} onClick={() => changeSection(item.id)} className={`flex-1 rounded-lg py-2 text-sm ${section === item.id ? 'bg-[#ececec] font-medium' : ''}`}>{item.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#888]">正在读取资料...</div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-600">{error}</div>
          ) : (
            <div className="flex-1 min-h-0 flex">
              <aside className="w-[260px] shrink-0 bg-[#fafafa] border-r border-black/[0.07] overflow-y-auto p-3">
                <div className="px-2 py-2 mb-1">
                  <div className="text-sm font-semibold">{SECTIONS.find((item) => item.id === section)?.label}</div>
                  <div className="text-[11px] text-[#999] mt-0.5">{documents.length} 个文件</div>
                </div>
                {documents.map((document) => (
                  <button key={document.path} onClick={() => setSelectedPath(document.path)} className={`w-full flex items-start gap-2 rounded-lg px-2.5 py-2.5 text-left mb-0.5 ${selectedPath === document.path ? 'bg-[#e8e8e8]' : 'hover:bg-[#f0f0f0]'}`}>
                    <span className="mt-0.5 text-[#777]"><FileIcon /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{document.name.replace(/_/g, ' ')}</span>
                      <span className="block truncate text-[10px] text-[#999] mt-0.5">{document.path}</span>
                    </span>
                  </button>
                ))}
                {documents.length === 0 && <div className="px-2 py-8 text-center text-xs text-[#999]">暂无内容</div>}
              </aside>

              <article className="flex-1 min-w-0 overflow-y-auto bg-white">
                {selected ? (
                  <div className="max-w-3xl mx-auto px-6 md:px-10 py-9 md:py-12">
                    <div className="mb-8 pb-5 border-b border-black/[0.08]">
                      <h1 className="text-2xl font-semibold tracking-[-0.025em]">{selected.name.replace(/_/g, ' ')}</h1>
                      <div className="mt-2 font-mono text-[11px] text-[#999]">{selected.path}</div>
                    </div>
                    {selected.format === 'markdown' ? (
                      <div className="markdown-body admin-document">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <pre className="yaml-document"><code>{selected.content}</code></pre>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-[#999]">请选择一个文件</div>
                )}
              </article>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
