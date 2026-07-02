import { useEffect, useMemo, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { getMemoryGraph } from '../../api'
import type { MemoryGraphData, MemoryKind } from '../../types'

interface Props {
  profileId: string
  onSelectMemory: (kind: MemoryKind, slug: string) => void
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  type: 'concept' | 'memory'
  label: string
  kind?: MemoryKind
  slug?: string
  linked?: boolean
}

const WIDTH = 640
const HEIGHT = 460
const CONCEPT_RADIUS = 26
const MEMORY_RADIUS = 13

function layoutGraph(data: MemoryGraphData): { nodes: GraphNode[]; links: Array<SimulationLinkDatum<GraphNode>> } {
  const nodes: GraphNode[] = [
    ...data.concepts.map((concept) => ({ id: `concept:${concept.slug}`, type: 'concept' as const, label: concept.title })),
    ...data.memories.map((memory) => ({
      id: `memory:${memory.kind}:${memory.slug}`,
      type: 'memory' as const,
      label: memory.title,
      kind: memory.kind,
      slug: memory.slug,
      linked: memory.linked,
    })),
  ]

  const links: Array<SimulationLinkDatum<GraphNode>> = data.edges.map((edge) => ({
    source: `concept:${edge.conceptSlug}`,
    target: `memory:${edge.memoryKind}:${edge.memorySlug}`,
  }))

  // Run the simulation to convergence once and render the frozen result -
  // no live physics loop, no re-layout on every hover/selection re-render.
  forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-140))
    .force(
      'link',
      forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(links)
        .id((node) => node.id)
        .distance(85),
    )
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
    .force(
      'collide',
      forceCollide<GraphNode>().radius((node) => (node.type === 'concept' ? CONCEPT_RADIUS + 6 : MEMORY_RADIUS + 6)),
    )
    .stop()
    .tick(300)

  return { nodes, links }
}

function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

export default function MemoryGraph({ profileId, onSelectMemory }: Props) {
  const [data, setData] = useState<MemoryGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setHoveredId(null)
    getMemoryGraph(profileId)
      .then(setData)
      .catch(() => setError('无法加载记忆关联图'))
      .finally(() => setLoading(false))
  }, [profileId])

  const layout = useMemo(() => (data ? layoutGraph(data) : null), [data])

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-[#888]">正在加载关联图...</div>
  }
  if (error) {
    return <div className="h-full flex items-center justify-center text-sm text-red-600">{error}</div>
  }
  if (!data || !layout) return null
  if (data.concepts.length === 0 && data.memories.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-[#999]">暂无记忆数据</div>
  }

  const { nodes, links } = layout
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const connectedIds = (id: string): Set<string> => {
    const connected = new Set<string>([id])
    for (const link of links) {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
      if (sourceId === id) connected.add(targetId)
      if (targetId === id) connected.add(sourceId)
    }
    return connected
  }
  const highlighted = hoveredId ? connectedIds(hoveredId) : null

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-1 text-xs text-[#999]">
        圆点越大代表越核心的主题；点击记忆节点跳转到正文；虚线灰色节点表示还未经过加工归类
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="flex-1 w-full">
        <g>
          {links.map((link, index) => {
            const source = typeof link.source === 'string' ? nodeById.get(link.source) : (link.source as GraphNode)
            const target = typeof link.target === 'string' ? nodeById.get(link.target) : (link.target as GraphNode)
            if (!source || !target) return null
            const dimmed = highlighted ? !(highlighted.has(source.id) && highlighted.has(target.id)) : false
            return (
              <line
                key={index}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#d4d4d4"
                strokeWidth={1}
                opacity={dimmed ? 0.12 : 0.8}
              />
            )
          })}
        </g>
        <g>
          {nodes.map((node) => {
            const dimmed = highlighted ? !highlighted.has(node.id) : false
            const isConcept = node.type === 'concept'
            const radius = isConcept ? CONCEPT_RADIUS : MEMORY_RADIUS
            const unprocessed = node.type === 'memory' && node.linked === false
            const fill = isConcept ? '#1d4ed8' : unprocessed ? '#d4d4d4' : node.kind === 'decision' ? '#92400e' : '#171717'
            return (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                opacity={dimmed ? 0.2 : 1}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                onClick={() => {
                  if (node.type === 'memory' && node.kind && node.slug) onSelectMemory(node.kind, node.slug)
                }}
                className={node.type === 'memory' ? 'cursor-pointer' : undefined}
              >
                <circle
                  r={radius}
                  fill={fill}
                  stroke={unprocessed ? '#999' : 'none'}
                  strokeWidth={unprocessed ? 1.5 : 0}
                  strokeDasharray={unprocessed ? '3 2' : undefined}
                />
                <title>{node.label}</title>
                <text y={radius + 12} textAnchor="middle" fontSize={isConcept ? 11 : 9.5} fill="#444" className="select-none">
                  {truncateLabel(node.label, isConcept ? 16 : 14)}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
