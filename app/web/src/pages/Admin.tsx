import { useEffect, useMemo, useState } from 'react'
import {
  getProfileAvatarUrl,
  getAdminSections,
  getAdminMemory,
  updateAdminSection,
  updateAdminMemory,
} from '../api'
import type { MemoryItemRecord, ProfileMeta, ProfileSectionRecord } from '../types'
import ProfileAvatar from '../components/ProfileAvatar'
import SupplementaryMaterials from './admin/SupplementaryMaterials'

type View = 'profile' | 'knowledge' | 'supplementary'

const NAV_ITEMS: Array<{ id: View; label: string; description: string }> = [
  { id: 'profile', label: '画像', description: '价值观、认知方式、领域判断与当前情境' },
  { id: 'knowledge', label: '记忆', description: '知识条目与决策记录' },
  { id: 'supplementary', label: '补充资料', description: '提交新资料，分析加工后补充进画像或记忆' },
]

const CONFIDENCE_OPTIONS = ['high', 'medium', 'low']
const OUTCOME_OPTIONS = ['pending', 'validated', 'invalidated']

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

function sectionKeyOf(doc: ProfileSectionRecord): string {
  return `${doc.layer}:${doc.sectionKey}`
}

function memoryKeyOf(doc: MemoryItemRecord): string {
  return `${doc.kind}:${doc.slug}`
}

function parseListInput(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export default function Admin({ profiles, initialProfileId, onClose }: Props) {
  const [profileId, setProfileId] = useState(initialProfileId)
  const [view, setView] = useState<View>('profile')
  const [sections, setSections] = useState<ProfileSectionRecord[] | null>(null)
  const [memoryItems, setMemoryItems] = useState<MemoryItemRecord[] | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(() => new Set([initialProfileId]))

  const [draftBody, setDraftBody] = useState('')
  const [draftDomains, setDraftDomains] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftMemoryType, setDraftMemoryType] = useState('')
  const [draftConfidence, setDraftConfidence] = useState('')
  const [draftOutcome, setDraftOutcome] = useState('')
  const [draftSourceLabel, setDraftSourceLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const loadProfileData = (id: string) => {
    setLoading(true)
    setError('')
    Promise.all([getAdminSections(id), getAdminMemory(id)])
      .then(([s, m]) => {
        setSections(s)
        setMemoryItems(m)
        setSelectedKey((current) => {
          if (current) return current
          if (view === 'profile') return s[0] ? sectionKeyOf(s[0]) : ''
          if (view === 'knowledge') return m[0] ? memoryKeyOf(m[0]) : ''
          return current
        })
      })
      .catch(() => setError('无法加载该数字人的资料'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProfileData(profileId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const profileDocs = sections ?? []
  const memoryDocs = memoryItems ?? []

  const documents = view === 'profile' ? profileDocs : view === 'knowledge' ? memoryDocs : []

  const selectedSection = useMemo(
    () => (view === 'profile' ? profileDocs.find((doc) => sectionKeyOf(doc) === selectedKey) : undefined),
    [view, profileDocs, selectedKey],
  )
  const selectedMemory = useMemo(
    () => (view === 'knowledge' ? memoryDocs.find((doc) => memoryKeyOf(doc) === selectedKey) : undefined),
    [view, memoryDocs, selectedKey],
  )

  useEffect(() => {
    setSaveMessage('')
    if (selectedSection) {
      setDraftBody(selectedSection.bodyMd)
    } else if (selectedMemory) {
      setDraftBody(selectedMemory.bodyMd)
      setDraftDomains(selectedMemory.domains.join(', '))
      setDraftTags(selectedMemory.tags.join(', '))
      setDraftMemoryType(selectedMemory.memoryType ?? '')
      setDraftConfidence(selectedMemory.confidence ?? '')
      setDraftOutcome(selectedMemory.outcome ?? '')
      setDraftSourceLabel(selectedMemory.sourceLabel ?? '')
    }
    // Deliberately keyed on selectedKey/view (which document) rather than the
    // selectedSection/selectedMemory objects: a save replaces those objects
    // with a new reference (optimistic update), which would otherwise re-run
    // this effect and immediately wipe the just-set saveMessage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, view])

  const changeView = (next: View) => {
    setView(next)
    if (next === 'profile') setSelectedKey(profileDocs[0] ? sectionKeyOf(profileDocs[0]) : '')
    else if (next === 'knowledge') setSelectedKey(memoryDocs[0] ? memoryKeyOf(memoryDocs[0]) : '')
    else setSelectedKey('')
  }

  const selectProfileView = (nextProfileId: string, nextView: View) => {
    setExpandedProfiles((current) => new Set(current).add(nextProfileId))
    setView(nextView)
    if (nextProfileId === profileId) {
      if (nextView === 'profile') setSelectedKey(profileDocs[0] ? sectionKeyOf(profileDocs[0]) : '')
      else if (nextView === 'knowledge') setSelectedKey(memoryDocs[0] ? memoryKeyOf(memoryDocs[0]) : '')
      else setSelectedKey('')
    } else {
      setSelectedKey('')
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

  const isDirty = selectedSection
    ? draftBody !== selectedSection.bodyMd
    : selectedMemory
      ? draftBody !== selectedMemory.bodyMd ||
        draftDomains !== selectedMemory.domains.join(', ') ||
        draftTags !== selectedMemory.tags.join(', ') ||
        draftMemoryType !== (selectedMemory.memoryType ?? '') ||
        draftConfidence !== (selectedMemory.confidence ?? '') ||
        draftOutcome !== (selectedMemory.outcome ?? '') ||
        draftSourceLabel !== (selectedMemory.sourceLabel ?? '')
      : false

  const handleSaveSection = async () => {
    if (!selectedSection) return
    setSaving(true)
    setSaveMessage('')
    try {
      await updateAdminSection(profileId, selectedSection.layer, selectedSection.sectionKey, draftBody)
      const today = new Date().toISOString().slice(0, 10)
      setSections((current) =>
        current?.map((doc) =>
          sectionKeyOf(doc) === sectionKeyOf(selectedSection)
            ? { ...doc, bodyMd: draftBody, lastUpdated: today }
            : doc,
        ) ?? null,
      )
      setSaveMessage('已保存')
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMemory = async () => {
    if (!selectedMemory) return
    setSaving(true)
    setSaveMessage('')
    const payload = {
      content: draftBody,
      domains: parseListInput(draftDomains),
      tags: parseListInput(draftTags),
      memoryType: draftMemoryType.trim() || null,
      confidence: draftConfidence.trim() || null,
      outcome: draftOutcome.trim() || null,
      sourceLabel: draftSourceLabel.trim() || null,
    }
    try {
      await updateAdminMemory(profileId, selectedMemory.kind, selectedMemory.slug, payload)
      setMemoryItems((current) =>
        current?.map((doc) =>
          memoryKeyOf(doc) === memoryKeyOf(selectedMemory)
            ? {
                ...doc,
                bodyMd: payload.content,
                domains: payload.domains,
                tags: payload.tags,
                memoryType: payload.memoryType,
                confidence: payload.confidence as MemoryItemRecord['confidence'],
                outcome: payload.outcome as MemoryItemRecord['outcome'],
                sourceLabel: payload.sourceLabel,
              }
            : doc,
        ) ?? null,
      )
      setSaveMessage('已保存')
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full bg-[#f7f7f8] flex flex-col text-[#151515]">
      <header className="h-16 shrink-0 bg-white border-b border-black/[0.07] px-4 md:px-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="icon-button" onClick={onClose} title="返回对话"><ArrowLeft /></button>
          <div>
            <div className="font-semibold tracking-[-0.02em]">数字人资料库</div>
            <div className="text-[11px] text-[#888]">画像与记忆可编辑保存</div>
          </div>
        </div>
        <select value={profileId} onChange={(event) => { setSelectedKey(''); setProfileId(event.target.value) }} className="admin-select md:hidden">
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
                    {NAV_ITEMS.map((item) => {
                      const selectedView = active && view === item.id
                      const count = active
                        ? item.id === 'profile' ? profileDocs.length
                        : item.id === 'knowledge' ? memoryDocs.length
                        : undefined
                        : undefined
                      return (
                        <button key={item.id} onClick={() => selectProfileView(profile.id, item.id)} className={`w-full rounded-lg px-2.5 py-2 text-left ${selectedView ? 'bg-[#e7e7e7]' : 'hover:bg-[#f1f1f1]'}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${selectedView ? 'font-medium text-black' : 'text-[#555]'}`}>{item.label}</span>
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
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => changeView(item.id)} className={`flex-1 rounded-lg py-2 text-sm ${view === item.id ? 'bg-[#ececec] font-medium' : ''}`}>{item.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#888]">正在读取资料...</div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-600">{error}</div>
          ) : view === 'supplementary' ? (
            <SupplementaryMaterials profileId={profileId} onMaterialApplied={() => loadProfileData(profileId)} />
          ) : (
            <div className="flex-1 min-h-0 flex">
              <aside className="w-[260px] shrink-0 bg-[#fafafa] border-r border-black/[0.07] overflow-y-auto p-3">
                <div className="px-2 py-2 mb-1">
                  <div className="text-sm font-semibold">{NAV_ITEMS.find((item) => item.id === view)?.label}</div>
                  <div className="text-[11px] text-[#999] mt-0.5">{documents.length} 个文件</div>
                </div>
                {view === 'profile' && profileDocs.map((doc) => (
                  <button key={sectionKeyOf(doc)} onClick={() => setSelectedKey(sectionKeyOf(doc))} className={`w-full flex items-start gap-2 rounded-lg px-2.5 py-2.5 text-left mb-0.5 ${selectedKey === sectionKeyOf(doc) ? 'bg-[#e8e8e8]' : 'hover:bg-[#f0f0f0]'}`}>
                    <span className="mt-0.5 text-[#777]"><FileIcon /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{(doc.title ?? doc.sectionKey).replace(/_/g, ' ')}</span>
                      <span className="block truncate text-[10px] text-[#999] mt-0.5">{doc.layer}/{doc.sectionKey}</span>
                    </span>
                  </button>
                ))}
                {view === 'knowledge' && memoryDocs.map((doc) => (
                  <button key={memoryKeyOf(doc)} onClick={() => setSelectedKey(memoryKeyOf(doc))} className={`w-full flex items-start gap-2 rounded-lg px-2.5 py-2.5 text-left mb-0.5 ${selectedKey === memoryKeyOf(doc) ? 'bg-[#e8e8e8]' : 'hover:bg-[#f0f0f0]'}`}>
                    <span className="mt-0.5 text-[#777]"><FileIcon /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{(doc.title ?? doc.slug).replace(/_/g, ' ')}</span>
                      <span className="block truncate text-[10px] text-[#999] mt-0.5">{doc.kind === 'decision' ? '决策' : '条目'} · {doc.happenedOn ?? ''}</span>
                    </span>
                  </button>
                ))}
                {documents.length === 0 && <div className="px-2 py-8 text-center text-xs text-[#999]">暂无内容</div>}
              </aside>

              <article className="flex-1 min-w-0 overflow-y-auto bg-white">
                {selectedSection ? (
                  <div className="max-w-3xl mx-auto px-6 md:px-10 py-9 md:py-12">
                    <div className="mb-6 pb-5 border-b border-black/[0.08]">
                      <h1 className="text-2xl font-semibold tracking-[-0.025em]">{(selectedSection.title ?? selectedSection.sectionKey).replace(/_/g, ' ')}</h1>
                      <div className="mt-2 font-mono text-[11px] text-[#999]">{selectedSection.layer}/{selectedSection.sectionKey} · 上次更新 {selectedSection.lastUpdated ?? '—'}</div>
                    </div>
                    <textarea
                      className="w-full min-h-[420px] rounded-lg border border-black/10 p-4 text-[14px] leading-7 font-mono focus:outline-none focus:border-black/30"
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                    />
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        className="rounded-lg bg-black text-white text-sm px-4 py-2 disabled:opacity-40"
                        disabled={!isDirty || saving}
                        onClick={handleSaveSection}
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                      {saveMessage && <span className="text-xs text-[#666]">{saveMessage}</span>}
                    </div>
                  </div>
                ) : selectedMemory ? (
                  <div className="max-w-3xl mx-auto px-6 md:px-10 py-9 md:py-12">
                    <div className="mb-6 pb-5 border-b border-black/[0.08]">
                      <h1 className="text-2xl font-semibold tracking-[-0.025em]">{(selectedMemory.title ?? selectedMemory.slug).replace(/_/g, ' ')}</h1>
                      <div className="mt-2 font-mono text-[11px] text-[#999]">{selectedMemory.kind === 'decision' ? '决策日志' : '知识条目'} · {selectedMemory.slug}</div>
                    </div>
                    <textarea
                      className="w-full min-h-[320px] rounded-lg border border-black/10 p-4 text-[14px] leading-7 font-mono focus:outline-none focus:border-black/30"
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                    />
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <label className="text-xs text-[#666]">
                        领域 domains（逗号分隔）
                        <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftDomains} onChange={(event) => setDraftDomains(event.target.value)} />
                      </label>
                      <label className="text-xs text-[#666]">
                        标签 tags（逗号分隔）
                        <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} />
                      </label>
                      <label className="text-xs text-[#666]">
                        类型 type
                        <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftMemoryType} onChange={(event) => setDraftMemoryType(event.target.value)} placeholder="opinion / framework / fact / reflection" />
                      </label>
                      <label className="text-xs text-[#666]">
                        来源 source
                        <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftSourceLabel} onChange={(event) => setDraftSourceLabel(event.target.value)} />
                      </label>
                      {selectedMemory.kind === 'entry' && (
                        <label className="text-xs text-[#666]">
                          信心 confidence
                          <select className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftConfidence} onChange={(event) => setDraftConfidence(event.target.value)}>
                            <option value="">（未设置）</option>
                            {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                      )}
                      {selectedMemory.kind === 'decision' && (
                        <label className="text-xs text-[#666]">
                          结果 outcome
                          <select className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={draftOutcome} onChange={(event) => setDraftOutcome(event.target.value)}>
                            <option value="">（未设置）</option>
                            {OUTCOME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        className="rounded-lg bg-black text-white text-sm px-4 py-2 disabled:opacity-40"
                        disabled={!isDirty || saving}
                        onClick={handleSaveMemory}
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                      {saveMessage && <span className="text-xs text-[#666]">{saveMessage}</span>}
                    </div>
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
