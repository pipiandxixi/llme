import { useEffect, useState } from 'react'
import {
  getRawMaterials,
  submitRawMaterial,
  analyzeRawMaterial,
  getProposals,
  decideProposal,
} from '../../api'
import type { ContentProposal, RawMaterial } from '../../types'

interface Props {
  profileId: string
  onMaterialApplied?: () => void
}

const STATUS_LABEL: Record<string, string> = {
  pending_processing: '待分析',
  processed: '已完成',
}

function proposalTargetLabel(proposal: ContentProposal): string {
  if (proposal.targetType === 'memory_item') {
    const kindLabel = proposal.memoryKind === 'decision' ? '决策日志' : '知识条目'
    return `新记忆 · ${kindLabel}`
  }
  const actionLabel = proposal.action === 'create' ? '新增画像章节' : '更新画像章节'
  return `${actionLabel} · ${proposal.layer}/${proposal.sectionKey}`
}

export default function SupplementaryMaterials({ profileId, onMaterialApplied }: Props) {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[] | null>(null)
  const [proposals, setProposals] = useState<ContentProposal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [analyzeMessage, setAnalyzeMessage] = useState<Record<string, string>>({})
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([getRawMaterials(profileId), getProposals(profileId, 'pending')])
      .then(([materials, pending]) => {
        setRawMaterials(materials)
        setProposals(pending)
      })
      .catch(() => setError('无法加载补充资料'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    setTitle('')
    setSourceLabel('')
    setContent('')
    setSubmitMessage('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const handleSubmit = async () => {
    if (!content.trim()) {
      setSubmitMessage('请输入正文内容')
      return
    }
    setSubmitting(true)
    setSubmitMessage('')
    try {
      await submitRawMaterial(profileId, { title: title.trim() || undefined, content, sourceLabel: sourceLabel.trim() || undefined })
      setTitle('')
      setSourceLabel('')
      setContent('')
      setSubmitMessage('已保存草稿')
      load()
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnalyze = async (materialId: string) => {
    setAnalyzingId(materialId)
    setAnalyzeMessage((current) => ({ ...current, [materialId]: '' }))
    try {
      const result = await analyzeRawMaterial(profileId, materialId)
      setAnalyzeMessage((current) => ({
        ...current,
        [materialId]: result.length > 0 ? `生成了 ${result.length} 条加工建议，请在下方确认` : '模型判断该资料暂无值得记录的新内容',
      }))
      load()
    } catch (err) {
      setAnalyzeMessage((current) => ({ ...current, [materialId]: err instanceof Error ? err.message : '分析失败' }))
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleDecide = async (proposalId: string, decision: 'approve' | 'reject') => {
    setDecidingId(proposalId)
    try {
      await decideProposal(proposalId, decision)
      load()
      onMaterialApplied?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setDecidingId(null)
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#888]">正在读取补充资料...</div>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-9 md:py-12 space-y-10">
        {error && <div className="text-sm text-red-600">{error}</div>}

        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] mb-1">提交新资料</h2>
          <p className="text-xs text-[#888] mb-4">粘贴一段文章、访谈或对话记录，保存为草稿后手动触发分析，分析出的建议需要你确认后才会真正写入画像或记忆。</p>
          <div className="space-y-3">
            <input
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              placeholder="标题（可选）"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              placeholder="来源标注（可选，例如：2026年某次访谈）"
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
            />
            <textarea
              className="w-full min-h-[180px] rounded-lg border border-black/10 p-3 text-[14px] leading-7 focus:outline-none focus:border-black/30"
              placeholder="粘贴正文内容..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg bg-black text-white text-sm px-4 py-2 disabled:opacity-40"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? '保存中...' : '保存草稿'}
              </button>
              {submitMessage && <span className="text-xs text-[#666]">{submitMessage}</span>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] mb-3">已提交的资料</h2>
          {(!rawMaterials || rawMaterials.length === 0) && (
            <div className="text-xs text-[#999]">暂无提交记录</div>
          )}
          <div className="space-y-2">
            {rawMaterials?.map((material) => (
              <div key={material.id} className="rounded-lg border border-black/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{material.title || material.slug}</div>
                    <div className="text-[11px] text-[#999] mt-0.5">{material.sourceLabel || '未标注来源'} · {STATUS_LABEL[material.processingStatus] ?? material.processingStatus}</div>
                  </div>
                  {material.processingStatus === 'pending_processing' && (
                    <button
                      className="shrink-0 rounded-lg border border-black/15 text-sm px-3 py-1.5 disabled:opacity-40"
                      disabled={analyzingId === material.id}
                      onClick={() => handleAnalyze(material.id)}
                    >
                      {analyzingId === material.id ? '分析中...' : '生成加工建议'}
                    </button>
                  )}
                </div>
                {analyzeMessage[material.id] && (
                  <div className="mt-2 text-xs text-[#666]">{analyzeMessage[material.id]}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] mb-3">待确认的加工建议</h2>
          {(!proposals || proposals.length === 0) && (
            <div className="text-xs text-[#999]">暂无待确认的建议</div>
          )}
          <div className="space-y-4">
            {proposals?.map((proposal) => (
              <div key={proposal.id} className="rounded-lg border border-black/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#999]">{proposalTargetLabel(proposal)}</div>
                    <div className="text-sm font-medium mt-0.5">{proposal.title || proposal.slug || proposal.sectionKey}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="rounded-lg bg-black text-white text-sm px-3 py-1.5 disabled:opacity-40"
                      disabled={decidingId === proposal.id}
                      onClick={() => handleDecide(proposal.id, 'approve')}
                    >
                      采纳
                    </button>
                    <button
                      className="rounded-lg border border-black/15 text-sm px-3 py-1.5 disabled:opacity-40"
                      disabled={decidingId === proposal.id}
                      onClick={() => handleDecide(proposal.id, 'reject')}
                    >
                      忽略
                    </button>
                  </div>
                </div>

                {proposal.targetType === 'memory_item' && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(proposal.proposedMetadata.domains ?? []).map((domain) => (
                      <span key={domain} className="text-[11px] rounded-full bg-[#f0f0f0] px-2 py-0.5">{domain}</span>
                    ))}
                    {(proposal.proposedMetadata.tags ?? []).map((tag) => (
                      <span key={tag} className="text-[11px] rounded-full bg-[#f0f0f0] px-2 py-0.5">#{tag}</span>
                    ))}
                  </div>
                )}

                {proposal.previousBodyMd ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-[#999] mb-1">原文</div>
                      <pre className="whitespace-pre-wrap text-[13px] leading-6 bg-[#f7f7f7] rounded-lg p-3 max-h-[280px] overflow-y-auto">{proposal.previousBodyMd}</pre>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#999] mb-1">建议内容</div>
                      <pre className="whitespace-pre-wrap text-[13px] leading-6 bg-[#f7f7f7] rounded-lg p-3 max-h-[280px] overflow-y-auto">{proposal.proposedBodyMd}</pre>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-[13px] leading-6 bg-[#f7f7f7] rounded-lg p-3 max-h-[280px] overflow-y-auto">{proposal.proposedBodyMd}</pre>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
