import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
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

const CONCEPT_RADIUS = 26
const MEMORY_RADIUS = 13
const CLICK_MOVE_THRESHOLD = 4

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
  // no live physics loop while idle. There is no fixed canvas size here
  // (pan/zoom + auto-fit handle whatever the graph's natural extent is).
  forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-160))
    .force(
      'link',
      forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(links)
        .id((node) => node.id)
        .distance(90),
    )
    .force('center', forceCenter(0, 0))
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

function computeBounds(nodes: GraphNode[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const r = node.type === 'concept' ? CONCEPT_RADIUS : MEMORY_RADIUS
    const x = node.x ?? 0
    const y = node.y ?? 0
    minX = Math.min(minX, x - r)
    maxX = Math.max(maxX, x + r)
    minY = Math.min(minY, y - r)
    maxY = Math.max(maxY, y + r)
  }
  if (!Number.isFinite(minX)) return { minX: -100, minY: -100, maxX: 100, maxY: 100 }
  return { minX, minY, maxX, maxY }
}

export default function MemoryGraph({ profileId, onSelectMemory }: Props) {
  const [data, setData] = useState<MemoryGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [, bumpRender] = useState(0)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const dragRef = useRef<{ node: GraphNode; startClientX: number; startClientY: number; moved: boolean } | null>(null)

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

  const fitToView = () => {
    const svg = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svg || !zoomBehavior || !layout) return
    const { minX, minY, maxX, maxY } = computeBounds(layout.nodes)
    const rect = svg.getBoundingClientRect()
    const width = rect.width || 640
    const height = rect.height || 460
    const padding = 48
    const scale = Math.min(
      (width - padding * 2) / Math.max(maxX - minX, 1),
      (height - padding * 2) / Math.max(maxY - minY, 1),
      1.4,
    )
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const initial = zoomIdentity.translate(width / 2, height / 2).scale(safeScale).translate(-centerX, -centerY)
    select(svg).call(zoomBehavior.transform, initial)
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !layout) return

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .filter((event) => {
        const target = event.target as Element
        return !target.closest?.('[data-graph-node]')
      })
      .on('zoom', (event) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k })
      })

    zoomBehaviorRef.current = behavior
    select(svg).call(behavior)
    fitToView()

    return () => {
      select(svg).on('.zoom', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

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

  const handlePointerDown = (node: GraphNode) => (event: React.PointerEvent<SVGGElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { node, startClientX: event.clientX, startClientY: event.clientY, moved: false }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY
    if (Math.abs(dx) > CLICK_MOVE_THRESHOLD || Math.abs(dy) > CLICK_MOVE_THRESHOLD) drag.moved = true
    drag.node.x = (drag.node.x ?? 0) + dx / transform.k
    drag.node.y = (drag.node.y ?? 0) + dy / transform.k
    drag.startClientX = event.clientX
    drag.startClientY = event.clientY
    bumpRender((tick) => tick + 1)
  }

  const handlePointerUp = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!drag.moved && drag.node.type === 'memory' && drag.node.kind && drag.node.slug) {
      onSelectMemory(drag.node.kind, drag.node.slug)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="px-6 pt-6 pb-1 text-xs text-[#999] flex items-center justify-between gap-3">
        <span>圆点越大代表越核心的主题；拖动画布/滚轮缩放；拖动节点可重新摆放；点击记忆节点跳转到正文；虚线灰色节点表示还未加工归类</span>
        <button onClick={fitToView} className="shrink-0 rounded-lg border border-black/10 px-2.5 py-1 text-[11px] text-[#555] hover:bg-[#f1f1f1]">
          适应窗口
        </button>
      </div>
      <svg ref={svgRef} className="flex-1 w-full touch-none" style={{ cursor: 'grab' }}>
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
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
                  data-graph-node="true"
                  transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                  opacity={dimmed ? 0.2 : 1}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                  onPointerDown={handlePointerDown(node)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={node.type === 'memory' ? 'cursor-pointer' : 'cursor-grab'}
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
        </g>
      </svg>
    </div>
  )
}
