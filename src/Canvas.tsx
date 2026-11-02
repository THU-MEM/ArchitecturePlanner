import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, useNodesInitialized, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { addRelationship, statuses, updateModule } from './plan.ts'
import type { Module, Person, Plan } from './plan.ts'
import { OwnerAvatars } from './Avatar.tsx'
import Icon from './Icon.tsx'
import { componentIcons, moduleIcon, uiIcon } from './icons.ts'
import type { IconReference } from './icons.ts'
import '@xyflow/react/dist/style.css'

type PlannerNode = Node<{ module: Module; people: Person[]; logos: IconReference[] }, 'module'>
function ModuleNode({ data }: NodeProps<PlannerNode>) {
  return <div className={`planner-node layer-${data.module.layer}`}>
    <Handle type="target" position={Position.Top} />
    <div className="node-meta"><Icon icon={moduleIcon(data.module.id)} decorative /><span className="code">{data.module.id}</span><span className={`node-state status-${data.module.status}`} title={statuses[data.module.status]} aria-label={statuses[data.module.status]} /></div>
    <strong>{data.module.name}</strong>
    <div className="node-footer"><div className="logo-stack">{data.logos.map(icon => <Icon key={icon.src} icon={icon} />)}</div>{data.module.owners.length ? <OwnerAvatars owners={data.module.owners} people={data.people} /> : <span className="node-owner" title="未分配"><Icon icon={uiIcon('person')} decorative /></span>}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
}
const nodeTypes = { module: ModuleNode }

export default function Canvas({ plan, visible, selected, onSelect, onChange }: {
  plan: Plan; visible: Module[]; selected: string; onSelect: (id: string) => void; onChange: (plan: Plan) => void
}) {
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [showAllEdges, setShowAllEdges] = useState(false)
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({})
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow<PlannerNode>()
  const visibleIds = visible.map(module => module.id).join(',')
  useEffect(() => {
    if (initialized && visible.length < plan.modules.length) {
      void fitView({ nodes: visibleIds.split(',').map(id => ({ id })), maxZoom: 0.8 })
    }
  }, [initialized, visibleIds, visible.length, plan.modules.length, fitView])
  const nodes = useMemo<PlannerNode[]>(() => visible.map(module => ({
    id: module.id, type: 'module', position: module.position, selected: selected === module.id, deletable: false, measured: sizes[module.id],
    data: {
      module,
      people: plan.people,
      logos: [...new Map(plan.components.filter(component => module.components.includes(component.id)).flatMap(componentIcons).filter(icon => icon.brand).map(icon => [icon.src, icon])).values()].slice(0, 6),
    },
    ariaLabel: `${module.id} ${module.name}`,
  })), [visible, plan.people, plan.components, selected, sizes])
  const availableEdges = plan.relationships.filter(edge => visible.some(module => module.id === edge.source) && visible.some(module => module.id === edge.target))
  const edges = availableEdges.filter(edge => availableEdges.length <= 12 || showAllEdges || edge.source === selected || edge.target === selected)
    .map(edge => ({ ...edge, selected: edge.id === selectedEdge, markerEnd: { type: MarkerType.ArrowClosed } }))
  return <div className="canvas">
    {availableEdges.length > 12 && <div className="canvas-toolbar"><label className="check"><input type="checkbox" checked={showAllEdges} onChange={event => setShowAllEdges(event.target.checked)} />全部连线</label><output aria-label="显示的依赖数" title="当前模块相关连线 / 全部可见依赖">{edges.length}/{availableEdges.length}</output></div>}
    <ReactFlow<PlannerNode>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      defaultViewport={{ x: 20, y: 20, zoom: 0.8 }} minZoom={0.15} maxZoom={1.7} deleteKeyCode={['Backspace', 'Delete']}
      onNodesChange={changes => {
        const dimensions = changes.filter(change => change.type === 'dimensions')
        if (dimensions.length) setSizes(previous => {
          const next = { ...previous }
          for (const change of dimensions) if (change.dimensions) next[change.id] = change.dimensions
          return next
        })
        for (const change of changes) if (change.type === 'select' && change.selected) onSelect(change.id)
      }}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDrag={(_, node) => onChange(updateModule(plan, node.id, { position: node.position }))}
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
