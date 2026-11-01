import { useRef, useState } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps, ReactFlowInstance } from '@xyflow/react'
import type { Plan } from './plan.ts'
import { currentFlows, implementationStates, projectFacts } from './current-architecture.ts'
import type { ProjectFact } from './current-architecture.ts'
import Icon from './Icon.tsx'
import { componentIcons, uiIcon } from './icons.ts'

type ProjectNode = Node<{ fact: ProjectFact; selected: boolean; onSelect: (id: string) => void }, 'project'>

function ProjectNodeCard({ data }: NodeProps<ProjectNode>) {
  const { fact, selected, onSelect } = data
  return <>
    <button className={`project-node nodrag nopan ${fact.state} ${selected ? 'selected-project' : ''}`}
      aria-label={`查看现状 ${fact.name}`} onClick={() => onSelect(fact.id)}>
      <span className="project-node-heading"><span>{fact.project}</span><span className={`implementation-state ${fact.state}`}>{implementationStates[fact.state]}</span></span>
      <strong>{fact.name}</strong>
      <span className="project-node-stack"><Icon icon={componentIcons({ id: fact.components[0], name: fact.name, detail: fact.detail, stack: fact.stack })[0]} decorative /><span>{fact.stack}</span></span>
    </button>
    <Handle id="bottom-source" type="source" position={Position.Bottom} isConnectable={false} />
    <Handle id="top-target" type="target" position={Position.Top} isConnectable={false} />
    <Handle id="left-source" type="source" position={Position.Left} isConnectable={false} />
    <Handle id="left-target" type="target" position={Position.Left} isConnectable={false} />
    <Handle id="right-source" type="source" position={Position.Right} isConnectable={false} />
    <Handle id="right-target" type="target" position={Position.Right} isConnectable={false} />
  </>
}

const nodeTypes = { project: ProjectNodeCard }

export function ImplementationContext({ moduleId, componentId }: { moduleId?: string; componentId?: string }) {
  const facts = projectFacts.filter(fact => (moduleId && fact.modules.includes(moduleId)) || (componentId && fact.components.includes(componentId)))
  if (!facts.length) return null
  return <details className="implementation-context"><summary>现有工程</summary>
    <p className="muted">职责覆盖不代表整个模块已完成；不自动改变分工或开展状态。</p>
    {facts.map(fact => <section key={fact.id}><strong>{fact.project} · {fact.name}</strong><p>{fact.detail}</p></section>)}
  </details>
}

export default function CurrentArchitecture({ plan, onComponent, onModule }: {
  plan: Plan; onComponent: (id: string) => void; onModule: (id: string) => void
}) {
  const [selected, setSelected] = useState('mem-gateway')
  const flowRef = useRef<ReactFlowInstance<ProjectNode, Edge> | null>(null)
  const fact = projectFacts.find(item => item.id === selected)!
  const nodes: ProjectNode[] = projectFacts.map(item => ({
    id: item.id, type: 'project', position: item.position,
    draggable: false, deletable: false, selectable: false, focusable: false,
    domAttributes: { ...{ 'data-project': item.id }, title: item.name },
    data: { fact: item, selected: selected === item.id, onSelect: setSelected },
  }))
  const edges: Edge[] = currentFlows.map(flow => ({
    id: flow.id, source: flow.source, target: flow.target, label: flow.sourcePort === flow.targetPort && flow.sourcePort ? undefined : flow.label, type: 'smoothstep',
    sourceHandle: `${flow.sourcePort ?? 'bottom'}-source`, targetHandle: `${flow.targetPort ?? 'top'}-target`,
    selectable: false, focusable: false, deletable: false,
    domAttributes: { ...{ 'data-flow': flow.id, 'data-state': flow.state }, 'aria-description': flow.detail },
    style: { stroke: flow.state === 'planned' ? '#765921' : '#54778b', strokeDasharray: flow.state === 'planned' ? '6 5' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: flow.state === 'planned' ? '#765921' : '#54778b' },
    labelStyle: { fill: '#213c51', fontSize: 11 },
    labelBgStyle: { fill: '#f4f8fa', fillOpacity: 0.95 },
  }))
  return <section className="current-architecture" aria-label="当前项目架构">
    <div className="current-heading"><h3>SSO · MEM-AI</h3><p>源码已实现 ≠ 生产已上线</p></div>
    <div className="current-legend"><span className="implemented">实线 · 已有代码</span><span className="planned">虚线 · 待接入</span><span>核对：2026-11-02 · 未访问生产环境</span></div>
    <label className="current-picker">项目组件<select value={selected} onChange={event => {
      const id = event.target.value
      const node = nodes.find(item => item.id === id)!
      setSelected(id)
      void flowRef.current?.setCenter(node.position.x + 125, node.position.y + 58, { zoom: 0.9 })
    }}>{projectFacts.map(item => <option key={item.id} value={item.id}>{item.project} · {item.name}</option>)}</select></label>
    <div className="current-map">
      <ReactFlow<ProjectNode, Edge> nodes={nodes} nodeTypes={nodeTypes} edges={edges} onInit={instance => { flowRef.current = instance }} onNodeClick={(_, node) => setSelected(node.id)} defaultViewport={{ x: 20, y: 18, zoom: 0.9 }} minZoom={0.25} maxZoom={1.5}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null} proOptions={{ hideAttribution: false }}>
        <Background gap={24} color="#d8e3e9" /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <section className="current-detail" aria-label="项目实现详情">
      <div className="section-title"><h3>{fact.name}</h3><span className={`implementation-state ${fact.state}`}>{implementationStates[fact.state]}</span></div>
      <p className="current-stack">{fact.stack}</p><p>{fact.detail}</p>
      {fact.id === 'balance-integration' && <p>服务凭证仅用于余额查询，不是模型 API key，也不是用户 SSO token。</p>}
      <div className="current-links">{fact.components.filter(id => plan.components.some(component => component.id === id)).map(id => <button key={id} aria-label={`分配组件 ${id}`} title={plan.components.find(component => component.id === id)!.name} onClick={() => onComponent(id)}><Icon icon={uiIcon('person')} decorative />{id}</button>)}
        {fact.modules.filter(id => plan.modules.some(module => module.id === id)).map(id => <button key={id} aria-label={`分配模块 ${id}`} onClick={() => onModule(id)}>{id}</button>)}</div>
      <details className="compact-detail"><summary>来源与边界</summary>
        {fact.sources.map(source => <p key={source.label}>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</p>)}
        <p>SSO 依据 AI-MEM 内的源码快照；MEM-AI 依据公开上游源码，本仓尚未导入为子模块。AIMEM-LLMWiki 与 Case Management 是独立应用，平台身份接入仍待完成。规划台本身仍是本地模式，未接入 SSO；owner 不是登录账号或权限。</p>
      </details>
    </section>
  </section>
}
