import { useEffect, useRef, useState } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react'
import type { Node, NodeProps, ReactFlowInstance } from '@xyflow/react'
import type { Plan } from './plan.ts'
import { implementationStates, projectFacts } from './current-architecture.ts'
import { deploymentFactIds, runtimeSnapshot, runtimeStates, technicalDomains, technicalFacts, technicalFlows } from './technical-architecture.ts'
import type { TechnicalFact } from './technical-architecture.ts'
import { layoutGraph } from './graph-layout.ts'
import type { GraphLayout } from './graph-layout.ts'
import { DependencyConnector } from './Canvas.tsx'
import type { DependencyEdge } from './Canvas.tsx'
import Icon from './Icon.tsx'
import { componentIcons, uiIcon } from './icons.ts'

type ProjectNode = Node<{ fact: TechnicalFact; selected: boolean; onSelect: (id: string) => void }, 'project'>
type DomainNode = Node<{ label: string }, 'domain'>
type TechnicalNode = ProjectNode | DomainNode

function DomainFrame({ data }: NodeProps<DomainNode>) {
  return <div className="technical-domain-frame"><strong>{data.label}</strong></div>
}

function ProjectNodeCard({ data }: NodeProps<ProjectNode>) {
  const { fact, selected, onSelect } = data
  return <>
    <button className={`project-node nodrag nopan runtime-${fact.runtime} ${selected ? 'selected-project' : ''}`}
      aria-label={`查看现状 ${fact.name}`} aria-pressed={selected} title={`${fact.name} · ${runtimeStates[fact.runtime]} · ${fact.stack}`} onClick={() => onSelect(fact.id)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onSelect('') }
      }}>
      <span className="project-node-heading"><span>{fact.project}</span><span className={`runtime-state runtime-${fact.runtime}`}>{runtimeStates[fact.runtime]}</span></span>
      <strong>{fact.name}</strong>
      <span className="project-node-stack"><Icon icon={componentIcons({ id: fact.components[0], name: fact.name, detail: fact.detail, stack: fact.stack })[0]} decorative /><span>{fact.stack}</span></span>
    </button>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
}

const nodeTypes = { project: ProjectNodeCard, domain: DomainFrame }
const edgeTypes = { dependency: DependencyConnector }
const sizes = Object.fromEntries(technicalFacts.map(fact => [fact.id, { width: 270, height: 142 }]))

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
  const [selected, setSelected] = useState('')
  const [scope, setScope] = useState('deployment')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; layout: GraphLayout | null; error: string } | null>(null)
  const [fittedKey, setFittedKey] = useState('')
  const flowRef = useRef<ReactFlowInstance<TechnicalNode, DependencyEdge> | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const facts = technicalFacts.filter(item => scope === 'all' || (scope === 'deployment' ? deploymentFactIds.includes(item.id) : scope === 'runtime' ? item.runtime === 'ready' || item.runtime === 'blocked' : item.runtime !== 'ready' && item.runtime !== 'blocked'))
  const flows = technicalFlows.filter(flow => facts.some(item => item.id === flow.source) && facts.some(item => item.id === flow.target))
  const layoutInput = JSON.stringify({ modules: facts.map(({ id }) => ({ id })), relationships: flows.map(({ id, source, target }) => ({ id, source, target })) })
  const layoutKey = `${attempt}:${layoutInput}`
  const layout = result?.key === layoutKey ? result.layout : null
  const pending = result?.key !== layoutKey || fittedKey !== layoutKey
  const fact = facts.find(item => item.id === selected)
  const upstream = new Set(flows.filter(flow => flow.target === selected).map(flow => flow.source))
  const downstream = new Set(flows.filter(flow => flow.source === selected).map(flow => flow.target))
  useEffect(() => {
    let cancelled = false
    const input: { modules: { id: string }[]; relationships: Plan['relationships'] } = JSON.parse(layoutInput)
    void layoutGraph(input.modules, input.relationships, sizes, technicalDomains).then(value => {
      if (!cancelled) setResult({ key: layoutKey, layout: value, error: '' })
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ key: layoutKey, layout: null, error: `技术架构自动布局失败：${error instanceof Error ? error.message : String(error)}。请重新布局重试。` })
    })
    return () => { cancelled = true }
  }, [layoutInput, layoutKey])
  useEffect(() => {
    if (!layout) return
    let cancelled = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void flowRef.current?.fitView({ padding: 0.12, maxZoom: 0.85, minZoom: 0.04 }).then(() => {
          if (!cancelled) setFittedKey(layoutKey)
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [layout, layoutKey])
  function select(id: string) { setSelected(current => current === id ? '' : id) }
  const nodes: TechnicalNode[] = layout ? [
    ...technicalDomains.flatMap(domain => {
      const bounds = layout.groups[domain.id]
      return bounds ? [{
        id: domain.id, type: 'domain' as const, position: { x: bounds.x, y: bounds.y },
        style: { width: bounds.width, height: bounds.height }, data: { label: domain.label },
        zIndex: -1, draggable: false, selectable: false, focusable: false, deletable: false,
        ariaLabel: domain.label,
        domAttributes: { ...{ 'data-domain': domain.id }, title: domain.label },
      }] : []
    }),
    ...facts.map(item => ({
    id: item.id, type: 'project', position: layout.positions[item.id],
    draggable: false, deletable: false, selectable: false, focusable: false,
    className: [upstream.has(item.id) && 'node-upstream', downstream.has(item.id) && 'node-downstream', fact && item.id !== selected && !upstream.has(item.id) && !downstream.has(item.id) && 'node-dimmed'].filter(Boolean).join(' '),
    zIndex: selected === item.id ? 3 : upstream.has(item.id) || downstream.has(item.id) ? 2 : 0,
    domAttributes: { ...{ 'data-project': item.id, 'data-runtime': item.runtime }, title: item.observation },
    data: { fact: item, selected: selected === item.id, onSelect: select },
  } satisfies ProjectNode)),
  ] : []
  const edges: DependencyEdge[] = layout ? flows.map(flow => {
    const color = fact && flow.target === selected ? '#2167ad' : fact && flow.source === selected ? '#a34d12' : '#718592'
    return {
    id: flow.id, source: flow.source, target: flow.target, type: 'dependency',
    data: { points: layout.routes[flow.id] },
    selectable: false, focusable: false, deletable: false,
    domAttributes: { ...{ 'data-flow': flow.id, 'data-evidence': flow.evidence }, 'aria-description': `${flow.label}：${flow.detail}` },
    style: { stroke: color, strokeWidth: 1.6, strokeDasharray: flow.evidence === 'observed' ? undefined : flow.evidence === 'planned' ? '2 5' : '7 5', opacity: fact && flow.source !== selected && flow.target !== selected ? 0.25 : 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  }}) : []
  function inspect(id: string) {
    setSelected(id)
    const node = nodes.find(item => item.id === id)
    const bounds = mapRef.current?.getBoundingClientRect()
    if (node && bounds) void flowRef.current?.setViewport({
      x: bounds.width / 2 - (node.position.x + 135) * 0.9,
      y: bounds.height / 2 - (node.position.y + 71) * 0.9,
      zoom: 0.9,
    })
  }
  return <section className="current-architecture" aria-label="当前项目架构">
    <p className="runtime-summary">SSH 核对：{runtimeSnapshot.inspectedAt} · {runtimeSnapshot.nodes} 节点 / {runtimeSnapshot.pods} Pod · {runtimeSnapshot.running} Running / {runtimeSnapshot.pending} Pending · 只读快照，非实时监控 · <span>源码已实现 ≠ 生产已上线</span></p>
    <div className="technical-toolbar">
    <label>范围<select aria-label="技术架构范围" value={scope} onChange={event => { setScope(event.target.value); setSelected('') }}><option value="deployment">部署域与用户入口</option><option value="all">全部技术组件</option><option value="runtime">现场已部署</option><option value="source">源码与待接入</option></select></label>
    <label className="current-picker">项目组件<select value={selected} disabled={pending} onChange={event => inspect(event.target.value)}><option value="">未选中</option>{facts.map(item => <option key={item.id} value={item.id}>{item.project} · {item.name}</option>)}</select></label>
    <button type="button" disabled={pending && !result?.error} onClick={() => setAttempt(value => value + 1)}>重新布局</button>
    <button type="button" disabled={pending} onClick={() => void flowRef.current?.fitView({ padding: 0.12, minZoom: 0.04 })}>适应全图</button>
    <span className="technical-edge-legend">实线：现场资源关系 · 虚线：源码 / 模板 · 点线：待接入</span>
    </div>
    {result?.key === layoutKey && result.error && <p className="error" role="alert">{result.error}</p>}
    {pending && !result?.error && <p className="technical-layout-status" role="status">正在自动布局…</p>}
    <div className="technical-body"><div className="current-map" ref={mapRef}>
      <ReactFlow<TechnicalNode, DependencyEdge> nodes={nodes} nodeTypes={nodeTypes} edges={edges} edgeTypes={edgeTypes} onInit={instance => { flowRef.current = instance }} onPaneClick={() => setSelected('')} minZoom={0.04} maxZoom={1.5}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null} proOptions={{ hideAttribution: false }}>
        <Background gap={24} color="#d8e3e9" /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <section className="current-detail" aria-label="项目实现详情">
      {fact ? <>
      <div className="section-title"><h3>{fact.name}</h3><span className={`runtime-state runtime-${fact.runtime}`}>{runtimeStates[fact.runtime]}</span></div>
      <p className="runtime-observation">{fact.observation}</p>
      <p className="current-stack">{fact.stack}</p><p>{fact.detail}</p>
      {fact.id === 'balance-integration' && <p>服务凭证仅用于余额查询，不是模型 API key，也不是用户 SSO token。</p>}
      <div className="technical-dependencies">{(['upstream', 'downstream'] as const).map(direction => <section key={direction}><h4>{direction === 'upstream' ? '上游 → 当前' : '当前 → 下游'}</h4>
        {flows.filter(flow => direction === 'upstream' ? flow.target === selected : flow.source === selected).map(flow => {
          const other = technicalFacts.find(item => item.id === (direction === 'upstream' ? flow.source : flow.target))!
          return <button type="button" className={`technical-${direction}`} key={flow.id} title={flow.detail} onClick={() => inspect(other.id)}>{other.name}<small>{flow.label} · {flow.evidence === 'observed' ? '现场资源' : flow.evidence === 'source' ? '源码 / 模板' : '待接入'}</small></button>
        })}
        {!flows.some(flow => direction === 'upstream' ? flow.target === selected : flow.source === selected) && <p className="muted">无已记录关系</p>}
      </section>)}</div>
      <div className="current-links">{fact.components.filter(id => plan.components.some(component => component.id === id)).map(id => <button key={id} aria-label={`分配组件 ${id}`} title={plan.components.find(component => component.id === id)!.name} onClick={() => onComponent(id)}><Icon icon={uiIcon('person')} decorative />{id}</button>)}
        {fact.modules.filter(id => plan.modules.some(module => module.id === id)).map(id => <button key={id} aria-label={`分配模块 ${id}`} onClick={() => onModule(id)}>{id}</button>)}</div>
      <details className="compact-detail"><summary>来源与边界</summary>
        <p>{implementationStates[fact.state]}；源码状态与运行状态分开记录。</p>
        {fact.sources.map(source => <p key={source.label}>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</p>)}
        <p>SSO 与独立业务依据 AI-MEM 源码；MEM-AI 已通过子模块引用。资源就绪不等于业务验收，集群未见不代表其他机器未运行。规划台未接入 SSO；owner 不是登录账号或权限。</p>
      </details>
      </> : <><h3>技术组件详情</h3><p>点击卡片查看运行状态、来源与连接；再次点击取消选中。</p>
        {scope === 'deployment' && <section className="technical-dependencies" aria-label="目标部署与入口">
          <h4>现有基础上的目标架构</h4>
          <p>虚线框是主服务器与 GPU 服务器的部署边界，不代表已运行；框内卡片状态与连线证据分别标注。用户设备的 /app、PWA 与本地存储位于服务器域外。</p>
          {['homepage', 'ssh-tunnel', 'gpu-compute', 'browser-indexeddb'].map(id => <button type="button" key={id} disabled={pending} onClick={() => inspect(id)}>{technicalFacts.find(item => item.id === id)!.name}</button>)}
          <p>GPU → 主服务器建立 SSH -R；请求经主服务器 API → 隧道映射 → GPU 模型。新增目标尚未做现场核验。</p>
        </section>}
        {(scope === 'runtime' || scope === 'all') && <section className="technical-dependencies" aria-label="基础设施现场证据">
          <h4>基础设施 · 现场已运行</h4>
          {['cert-manager', 'coredns', 'metrics', 'calico'].map(id => {
            const item = technicalFacts.find(value => value.id === id)!
            return <button type="button" key={id} disabled={pending} aria-label={`核对${item.name}`} onClick={() => inspect(id)}>
              {item.name} · {item.stack}<small>{item.observation}</small>
            </button>
          })}
        </section>}
        <div className="runtime-legend">{Object.entries(runtimeStates).map(([state, label]) => <span className={`runtime-state runtime-${state}`} key={state}>{label}</span>)}</div><p>{runtimeSnapshot.method}</p><p>箭头按标注表示调用、承载、配置或存储关系；实线只证明现场资源或配置存在，不保证端到端业务可用。虚线与点线不是线上链路。</p></>}
    </section></div>
  </section>
}
