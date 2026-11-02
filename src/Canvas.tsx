import { useEffect, useMemo, useState } from 'react'
import { Background, BaseEdge, Controls, getSmoothStepPath, Handle, MarkerType, Position, ReactFlow, useNodesInitialized, useReactFlow } from '@xyflow/react'
import type { Edge, EdgeProps, Node, NodeProps } from '@xyflow/react'
import { addRelationship, layers, statuses } from './plan.ts'
import type { Module, Person, Plan } from './plan.ts'
import { layoutGraph } from './graph-layout.ts'
import type { GraphLayout, NodeSize } from './graph-layout.ts'
import { OwnerAvatars } from './Avatar.tsx'
import Icon from './Icon.tsx'
import { componentIcons, moduleIcon, uiIcon } from './icons.ts'
import type { IconReference } from './icons.ts'
import '@xyflow/react/dist/style.css'

type PlannerNode = Node<{ module: Module; people: Person[]; logos: IconReference[] }, 'module'>
function ModuleNode({ data }: NodeProps<PlannerNode>) {
  return <div className={`planner-node layer-${data.module.layer}`}>
    <Handle type="target" position={Position.Left} />
    <div className="node-meta" title={`${layers[data.module.layer] ?? data.module.layer} · ${data.module.name}`}><Icon icon={moduleIcon(data.module.id)} decorative /><span className="code">{data.module.id}</span><strong>{data.module.name}</strong><span className={`node-state status-${data.module.status}`} title={statuses[data.module.status]} aria-label={statuses[data.module.status]} /></div>
    <div className="node-footer"><div className="logo-stack">{data.logos.map(icon => <Icon key={icon.src} icon={icon} />)}</div>{data.module.owners.length ? <OwnerAvatars owners={data.module.owners} people={data.people} /> : <span className="node-owner" title="未分配"><Icon icon={uiIcon('person')} decorative /></span>}</div>
    <Handle type="source" position={Position.Right} />
  </div>
}
const nodeTypes = { module: ModuleNode }
type DependencyEdge = Edge<{ points?: { x: number; y: number }[] }, 'dependency'>
function DependencyConnector(props: EdgeProps<DependencyEdge>) {
  const points = props.data?.points
  const path = points?.length
    ? points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
    : getSmoothStepPath(props)[0]
  return <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={20} />
}
const edgeTypes = { dependency: DependencyConnector }
const edgeColors = { upstream: '#2167ad', downstream: '#a34d12', other: '#718592' }

export default function Canvas({ plan, visible, selected, onSelect, onChange }: {
  plan: Plan; visible: Module[]; selected: string; onSelect: (id: string) => void; onChange: (plan: Plan) => void
}) {
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [focusOnly, setFocusOnly] = useState(false)
  const [sizes, setSizes] = useState<Record<string, NodeSize>>({})
  const [layoutState, setLayoutState] = useState<{ key: string; value: GraphLayout | null; error: string } | null>(null)
  const [fittedLayoutKey, setFittedLayoutKey] = useState<string | null>(null)
  const [layoutAttempt, setLayoutAttempt] = useState(0)
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow<PlannerNode>()
  const availableEdges = useMemo(() => plan.relationships.filter(edge => visible.some(module => module.id === edge.source) && visible.some(module => module.id === edge.target)), [plan.relationships, visible])
  const neighborhood = useMemo(() => ({
    active: visible.some(module => module.id === selected),
    upstream: new Set(availableEdges.filter(edge => edge.target === selected).map(edge => edge.source)),
    downstream: new Set(availableEdges.filter(edge => edge.source === selected).map(edge => edge.target)),
  }), [availableEdges, visible, selected])
  const layoutInput = JSON.stringify({ modules: visible.map(({ id }) => ({ id })), relationships: availableEdges, sizes })
  const layoutKey = `${layoutAttempt}:${layoutInput}`
  const layout = layoutState?.value
  const layoutComputing = layoutState?.key !== layoutKey
  const layoutPending = layoutComputing || fittedLayoutKey !== layoutKey
  const layoutError = layoutPending ? '' : layoutState?.error
  const completedLayoutKey = layoutState?.key
  useEffect(() => {
    if (!initialized) return
    let cancelled = false
    const input: { modules: Pick<Module, 'id'>[]; relationships: Plan['relationships']; sizes: Record<string, NodeSize> } = JSON.parse(layoutInput)
    void layoutGraph(input.modules, input.relationships, input.sizes).then(result => {
      if (!cancelled) setLayoutState({ key: layoutKey, value: result, error: '' })
    }).catch((error: unknown) => {
      if (!cancelled) {
        setLayoutState(previous => ({
          key: layoutKey, value: previous?.value ?? null,
          error: `自动布局失败：${error instanceof Error ? error.message : String(error)}。可重试或手动拖动模块。`,
        }))
      }
    })
    return () => { cancelled = true }
  }, [initialized, layoutInput, layoutKey])
  useEffect(() => {
    if (!completedLayoutKey || layoutComputing) return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void fitView({ padding: 0.12, maxZoom: 0.85, minZoom: 0.04 }).then(() => {
          if (!cancelled) setFittedLayoutKey(completedLayoutKey)
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [completedLayoutKey, layoutComputing, fitView])
  const nodes = useMemo<PlannerNode[]>(() => visible.map(module => {
    const current = selected === module.id
    const upstream = neighborhood.upstream.has(module.id)
    const downstream = neighborhood.downstream.has(module.id)
    const dimmed = neighborhood.active && !current && !upstream && !downstream
    const relation = current ? '当前模块' : upstream && downstream ? '上游与下游' : upstream ? '上游模块' : downstream ? '下游模块' : ''
    return {
      id: module.id, type: 'module', position: layout?.positions[module.id] ?? module.position, selected: current, deletable: false, measured: sizes[module.id],
      className: [upstream && 'node-upstream', downstream && 'node-downstream', dimmed && 'node-dimmed'].filter(Boolean).join(' '),
      zIndex: current ? 3 : upstream || downstream ? 2 : 0,
      data: {
        module,
        people: plan.people,
        logos: [...new Map(plan.components.filter(component => module.components.includes(component.id)).flatMap(componentIcons).filter(icon => icon.brand).map(icon => [icon.src, icon])).values()].slice(0, 6),
      },
      ariaLabel: `${module.id} ${module.name}${relation ? ` · ${relation}` : ''}`,
    }
  }), [visible, plan.people, plan.components, selected, sizes, layout, neighborhood])
  const edges = availableEdges.filter(edge => !focusOnly || !neighborhood.active || edge.source === selected || edge.target === selected)
    .map<DependencyEdge>(edge => {
      const direction = edge.target === selected ? 'upstream' : edge.source === selected ? 'downstream' : 'other'
      const color = edgeColors[direction]
      return {
        ...edge, type: 'dependency', selected: edge.id === selectedEdge,
        data: { points: layout?.routes[edge.id] },
        className: `dependency-${direction}`,
        style: { stroke: color, strokeWidth: direction === 'other' ? 1.4 : 2.5, opacity: neighborhood.active && direction === 'other' ? 0.3 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      }
    })
  return <div className="canvas" onKeyDownCapture={event => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('.react-flow__node')) return
    const id = event.target.dataset.id
    if (!id) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      onSelect(selected === id ? '' : id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onSelect('')
    }
  }}>
    <div className="canvas-toolbar" aria-label="拓扑布局工具">
      <div className="canvas-toolbar-row">
        <button type="button" onClick={() => setLayoutAttempt(value => value + 1)} disabled={layoutPending}>重新布局</button>
        <label className="check"><input type="checkbox" checked={!focusOnly} onChange={event => setFocusOnly(!event.target.checked)} />全部连线</label>
        <output aria-label="显示的依赖数">{edges.length}/{availableEdges.length}</output>
        <div className="edge-legend" aria-label="相对选中模块的连线方向"><span className="legend-upstream">上游 → 当前</span><span className="legend-downstream">当前 → 下游</span><span>其他依赖</span></div>
        <div className="canvas-layer-legend" role="group" aria-label="架构层颜色图例">{Object.entries(layers).map(([id, name]) => <span className={`layer-key layer-${id}`} key={id}>{name}</span>)}</div>
        {layoutPending && <span role="status">正在自动布局…</span>}
      </div>
    </div>
    {layoutError && <p className="error" role="alert">{layoutError}</p>}
    <ReactFlow<PlannerNode, DependencyEdge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      defaultViewport={{ x: 20, y: 20, zoom: 0.8 }} minZoom={0.04} maxZoom={1.7} deleteKeyCode={['Backspace', 'Delete']}
      onNodesChange={changes => {
        const dimensions = changes.filter(change => change.type === 'dimensions')
        if (dimensions.length) setSizes(previous => {
          const next = { ...previous }
          for (const change of dimensions) if (change.dimensions) next[change.id] = change.dimensions
          return next
        })
      }}
      onNodeClick={(_, node) => onSelect(selected === node.id ? '' : node.id)}
      onPaneClick={() => { onSelect(''); setSelectedEdge(null) }}
      onNodeDragStart={(_, node) => onSelect(node.id)}
      onNodeDrag={(_, node) => {
        setLayoutState(current => current?.value ? ({
          ...current,
          value: {
            positions: { ...current.value.positions, [node.id]: node.position },
            routes: Object.fromEntries(Object.entries(current.value.routes).filter(([id]) => !availableEdges.some(edge => edge.id === id && (edge.source === node.id || edge.target === node.id)))),
          },
        }) : current)
        onChange({
          ...plan,
          modules: plan.modules.map(module => ({ ...module, position: module.id === node.id ? node.position : layout?.positions[module.id] ?? module.position })),
        })
      }}
      onConnect={connection => {
        if (connection.source && connection.target && connection.source !== connection.target) {
          onChange(addRelationship(plan, connection.source, connection.target))
        }
      }}
      onEdgesDelete={deleted => onChange({ ...plan, relationships: plan.relationships.filter(edge => !deleted.some(item => item.id === edge.id)) })}
      onEdgesChange={changes => {
        setSelectedEdge(current => {
          for (const change of changes) if (change.type === 'select') {
            if (change.selected) current = change.id
            else if (change.id === current) current = null
          }
          return current
        })
      }}
      proOptions={{ hideAttribution: false }}
    ><Background gap={22} color="#d4dfe5" /><Controls showInteractive={false} /></ReactFlow>
  </div>
}
