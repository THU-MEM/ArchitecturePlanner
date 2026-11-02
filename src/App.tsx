import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import publishedUrl from './seed-plan.json?url'
import { addPerson, assignOwners, assignComponentOwners, layers, MAX_PLAN_BYTES, statuses, updateModule, validatePlan } from './plan.ts'
import type { Component, Module, Plan } from './plan.ts'
import Canvas from './Canvas.tsx'
import CurrentArchitecture, { ImplementationContext } from './CurrentArchitecture.tsx'
import Icon, { IconButton } from './Icon.tsx'
import Avatar, { OwnerAvatars } from './Avatar.tsx'
import { componentIcons, moduleIcon, uiIcon } from './icons.ts'
import { githubProfileUrl, mergeGitHubParticipants } from './participants.ts'
import './App.css'

const storageKey = 'architecture-planner.plan.v1'
const githubEditUrl = 'https://github.com/THU-MEM/ArchitecturePlanner/edit/main/src/seed-plan.json'
const tabs = ['业务架构', '技术架构', '分工清单', '技术组件', '团队成员', '原始架构'] as const
type Tab = typeof tabs[number]
const tabIcons = ['canvas', 'layer', 'list', 'technology', 'users', 'original']
const participants: unknown = JSON.parse(import.meta.env.VITE_GITHUB_PARTICIPANTS ?? '[]')

function readDraft() {
  try {
    const raw = localStorage.getItem(storageKey)
    return { draft: raw ? mergeGitHubParticipants(validatePlan(JSON.parse(raw)), participants) : null, error: '' }
  } catch (error) {
    return {
      draft: null,
      error: `无法读取本地草稿：${error instanceof Error ? error.message : String(error)}。原草稿未覆盖，可导入已有备份。`,
    }
  }
}

function OwnerFields({ plan, primary, secondary, onPrimary, onSecondary, onTeam, neighborhood }: {
  plan: Plan; primary: string; secondary: string[]; onPrimary: (value: string) => void; onSecondary: (value: string[]) => void; onTeam: () => void
  neighborhood?: { upstream: Module[]; downstream: Module[] }
}) {
  return <fieldset><legend>分工</legend>
    <div className="owner-tools"><label>主 owner<select value={primary} onChange={event => {
      onPrimary(event.target.value)
      onSecondary(secondary.filter(id => id !== event.target.value))
    }}><option value="">未分配</option>{plan.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><IconButton icon="users" label="添加团队成员" onClick={onTeam} /></div>
    <div className="owner-options">{plan.people.map(person => {
      const current = primary === person.id || secondary.includes(person.id)
      const upstream = neighborhood?.upstream.some(module => module.owners.some(owner => owner.personId === person.id))
      const downstream = neighborhood?.downstream.some(module => module.owners.some(owner => owner.personId === person.id))
      const classes = neighborhood ? [current && 'person-current', upstream && 'person-upstream', downstream && 'person-downstream', !current && !upstream && !downstream && 'person-unrelated'].filter(Boolean).join(' ') : ''
      return <label className={`check ${classes}`} key={person.id}>
      <input type="checkbox" aria-label={`协作 owner ${person.name}`} disabled={primary === person.id} checked={secondary.includes(person.id)} onChange={event => onSecondary(event.target.checked ? [...secondary, person.id] : secondary.filter(id => id !== person.id))} />
      <Avatar person={person} />
      <span>{person.name}</span>
      {neighborhood && <small className="owner-relation">{[current && '当前', upstream && '上游', downstream && '下游'].filter(Boolean).join(' · ')}</small>}
    </label>})}</div>
  </fieldset>
}

function ComponentEditor({ component, plan, onApply, onTeam, onModule }: { component: Component; plan: Plan; onApply: (plan: Plan) => void; onTeam: () => void; onModule: (id: string) => void }) {
  const [primary, setPrimary] = useState(component.owners?.find(owner => owner.role === 'primary')?.personId ?? '')
  const [secondary, setSecondary] = useState(component.owners?.filter(owner => owner.role === 'secondary').map(owner => owner.personId) ?? [])
  const [error, setError] = useState('')
  return <form className="editor" onSubmit={event => {
    event.preventDefault()
    try { onApply(assignComponentOwners(plan, component.id, primary, secondary)); setError('') } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }}>
    <div className="component-identity"><div className="logo-stack">{componentIcons(component).map(icon => <Icon key={icon.src} icon={icon} />)}</div><h2>{component.name}</h2></div>
    <OwnerFields plan={plan} primary={primary} secondary={secondary} onPrimary={setPrimary} onSecondary={setSecondary} onTeam={onTeam} />
    <div className="related-modules">{plan.modules.filter(module => module.components.includes(component.id)).map(module => <button type="button" key={module.id} aria-label={`查看模块 ${module.id}`} title={module.name} onClick={() => onModule(module.id)}><Icon icon={moduleIcon(module.id)} decorative /><span className="code">{module.id}</span></button>)}</div>
    <details className="compact-detail"><summary>详情</summary><p>{component.detail}</p><small>{component.stack}</small></details>
    <ImplementationContext componentId={component.id} />
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary apply-button" type="submit" aria-label="应用修改"><Icon icon={uiIcon('check')} decorative />应用</button>
  </form>
}

function OwnerEditor({ module, plan, onApply, onTeam, onModule, highlightOwners = false }: { module: Module; plan: Plan; onApply: (plan: Plan) => void; onTeam: () => void; onModule: (id: string) => void; highlightOwners?: boolean }) {
  const [name, setName] = useState(module.name)
  const [summary, setSummary] = useState(module.summary)
  const [detail, setDetail] = useState(module.detail)
  const [primary, setPrimary] = useState(module.owners.find(owner => owner.role === 'primary')?.personId ?? '')
  const [secondary, setSecondary] = useState(module.owners.filter(owner => owner.role === 'secondary').map(owner => owner.personId))
  const [status, setStatus] = useState(module.status)
  const [references, setReferences] = useState(module.components)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [error, setError] = useState('')
  const upstream = plan.modules.filter(item => plan.relationships.some(edge => edge.source === item.id && edge.target === module.id))
  const downstream = plan.modules.filter(item => plan.relationships.some(edge => edge.source === module.id && edge.target === item.id))
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      const edited = updateModule(plan, module.id, { name, summary, detail, status, components: references })
      onApply(assignOwners(edited, module.id, primary, secondary))
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }
  return <form onSubmit={apply} className="editor">
    <div className="section-title"><h2><Icon icon={moduleIcon(module.id)} decorative />模块</h2><span className="code">{module.id}</span></div>
    <label>模块名称<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} /></label>
    <details className="compact-detail"><summary>说明</summary>
    <label>一句话职责<textarea value={summary} onChange={event => setSummary(event.target.value)} maxLength={500} rows={2} /></label>
    <label>详细说明<textarea value={detail} onChange={event => setDetail(event.target.value)} maxLength={5000} rows={4} /></label>
    </details>
    <label>开展状态<select value={status} onChange={event => {
      const value = event.target.value
      if (value === 'planned' || value === 'active' || value === 'done') setStatus(value)
    }}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <ImplementationContext moduleId={module.id} />
    <OwnerFields plan={plan} primary={primary} secondary={secondary} onPrimary={setPrimary} onSecondary={setSecondary} onTeam={onTeam} neighborhood={highlightOwners ? { upstream, downstream } : undefined} />
    <section className="mapping" aria-label="模块依赖">
      {([['上游', upstream], ['下游', downstream]] as const).map(([direction, modules]) => <div key={direction}>
        <h3>{direction}</h3><div className={`related-modules ${highlightOwners ? `related-${direction === '上游' ? 'upstream' : 'downstream'}` : ''}`}>{modules.length ? modules.map(item => <button type="button" key={item.id} aria-label={`查看${direction}模块 ${item.id}`} title={item.name} onClick={() => onModule(item.id)}><Icon icon={moduleIcon(item.id)} decorative /><span className="code">{item.id}</span>{highlightOwners && <><OwnerAvatars owners={item.owners} people={plan.people} /><span className="dependency-owners">{item.owners.map(owner => plan.people.find(person => person.id === owner.personId)?.name).filter(Boolean).join('、') || '未分配'}</span></>}</button>) : <span className="muted">—</span>}</div>
      </div>)}
    </section>
    <section className="mapping"><div className="section-title"><h3>组件</h3><IconButton icon="plus" label="添加组件" aria-expanded={mappingOpen} onClick={() => setMappingOpen(!mappingOpen)} /></div>
      <div className="mapped-icons">{plan.components.filter(component => references.includes(component.id)).map(component => <span key={component.id} className="mapped-icon" title={`${component.name} · ${component.stack}`}>{componentIcons(component).map(icon => <Icon key={icon.src} icon={icon} />)}</span>)}</div>
      {mappingOpen && <div className="component-picker" role="group" aria-label="可选技术组件">{plan.components.map(component => <label className="component-choice" key={component.id} title={component.detail}>
        <input type="checkbox" aria-label={`技术组件 ${component.name}`} checked={references.includes(component.id)} onChange={event => setReferences(event.target.checked ? [...references, component.id] : references.filter(id => id !== component.id))} />
        <div className="logo-stack">{componentIcons(component).map(icon => <Icon key={icon.src} icon={icon} />)}</div><span>{component.name}</span>
      </label>)}</div>}
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary apply-button" type="submit" aria-label="应用修改"><Icon icon={uiIcon('check')} decorative />应用</button>
  </form>
}

export default function App() {
  const [published, setPublished] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(publishedUrl, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setPublished(mergeGitHubParticipants(validatePlan(await response.json()), participants))
      } catch (error) {
        if (!controller.signal.aborted) setError(`已发布规划加载失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])
  if (published) return <Planner published={published} />
  return <main className="loading-plan">{error ? <><p className="error" role="alert">{error}</p><button onClick={() => { setError(''); setAttempt(value => value + 1) }}>重新加载</button></> : <p role="status">正在加载已发布规划…</p>}</main>
}

function Planner({ published }: { published: Plan }) {
  const [initial] = useState(readDraft)
  const [savedDraft, setSavedDraft] = useState(initial.draft)
  const [plan, setPlan] = useState(published)
  const [tab, setTab] = useState<Tab>('业务架构')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selected, setSelected] = useState('M01')
  const [selectedComponent, setSelectedComponent] = useState('workspace')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(initial.error)
  const [notice, setNotice] = useState('')
  const [personName, setPersonName] = useState('')
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [pendingImport, setPendingImport] = useState<Plan | null>(null)
  const [localSaved, setLocalSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  function discardSavedDraft() {
    try {
      localStorage.removeItem(storageKey)
      setSavedDraft(null)
      setError('')
      setNotice('')
    } catch (error) {
      setError(`删除本地草稿失败：${error instanceof Error ? error.message : String(error)}。草稿未删除，请重试。`)
    }
  }
  function apply(next: Plan) {
    setPlan(next)
    setSavedDraft(null)
    setDirty(true)
    setError('')
    setCopyFailed(false)
    setNotice('已应用 · 本地草稿，尚未提交到 GitHub')
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setLocalSaved(true)
    } catch (error) {
      setLocalSaved(false)
      setError(`本地保存失败，请导出文件：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty && !localSaved) event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, localSaved])

  const visible = plan.modules.filter(module => {
    const names = module.owners.map(owner => plan.people.find(person => person.id === owner.personId)?.name ?? '').join(' ')
    return (!layer || module.layer === layer)
      && (!ownerFilter || (ownerFilter === 'unassigned' ? !module.owners.length : module.owners.some(owner => owner.personId === ownerFilter)))
      && `${module.id} ${module.name} ${module.summary} ${names}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })
  const module = plan.modules.find(module => module.id === selected)
  const component = plan.components.find(component => component.id === selectedComponent) ?? plan.components[0]
  const visibleComponents = plan.components.filter(component => {
    const owners = component.owners ?? []
    const names = owners.map(owner => plan.people.find(person => person.id === owner.personId)?.name ?? '').join(' ')
    return (!ownerFilter || (ownerFilter === 'unassigned' ? !owners.length : owners.some(owner => owner.personId === ownerFilter)))
      && `${component.id} ${component.name} ${component.stack} ${names}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  }).sort((a, b) => Number(componentIcons(b).some(icon => icon.brand)) - Number(componentIcons(a).some(icon => icon.brand)))
  const assigned = plan.modules.filter(module => module.owners.some(owner => owner.role === 'primary')).length
    + plan.components.filter(component => component.owners?.some(owner => owner.role === 'primary')).length

  function exportPlan() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'architecture-plan.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('已导出 · 文件包含分工信息')
  }
  async function importPlan(file: File) {
    try {
      if (file.size > MAX_PLAN_BYTES) throw new Error('文件不能超过 512 KiB')
      const next = mergeGitHubParticipants(validatePlan(JSON.parse(await file.text())), participants)
      if (dirty) {
        setPendingImport(next)
        setNotice('导入文件已校验。确认后将替换当前草稿；建议先导出备份。')
      } else {
        apply(next)
        setSelected(next.modules[0]?.id ?? '')
      }
    } catch (error) {
      setError(`导入失败，现有规划未修改：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  async function copyAndEdit() {
    setBusy(true)
    setError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('浏览器不支持剪贴板写入')
      await navigator.clipboard.writeText(`${JSON.stringify(validatePlan(plan), null, 2)}\n`)
      setNotice('JSON 已复制 · 请在 GitHub 全选粘贴后提交')
      window.location.assign(githubEditUrl)
    } catch (error) {
      setCopyFailed(true)
      setError(`复制失败：${error instanceof Error ? error.message : String(error)}。请手动复制下方 JSON 或导出文件，再前往 GitHub 编辑。`)
    } finally {
      setBusy(false)
    }
  }
  return <div className={`app-shell ${tab === '业务架构' || tab === '技术架构' ? 'canvas-page' : ''}`}>
    <a className="skip" href="#workspace">跳到规划工作区</a>
    <header className="app-header">
      <div className="wordmark" title={plan.name}><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M4 4h9v9H4zm15 0h9v9h-9zM4 19h9v9H4zm15 0h9v9h-9z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 8h6M8 13v6m16-6v6m-11 5h6" fill="none" stroke="currentColor" strokeWidth="2" /></svg><span>ArchitecturePlanner</span><h1>架构规划台</h1></div>
      <div className="banner-context"><h2 id="view-title">{tab}{tab === '技术架构' && <span> · Kubernetes · 服务与数据</span>}</h2>{tab !== '技术架构' && <span className="view-count">{tab === '团队成员' ? plan.people.length : tab === '技术组件' ? visibleComponents.length : visible.length}</span>}</div>
      <div className="progress-label"><span>已分配</span><strong>{assigned}/{plan.modules.length + plan.components.length}</strong>{dirty && <span className="draft-indicator">未提交</span>}</div>
      <div className="header-actions">
        <IconButton icon="upload" label="导入规划" onClick={() => fileRef.current?.click()} /><IconButton icon="download" label="导出规划" onClick={exportPlan} />
        <IconButton icon="submit" label="提交到 GitHub" className="primary" disabled={busy} onClick={() => setSubmissionOpen(!submissionOpen)} aria-expanded={submissionOpen} />
        <a className="icon-button" href="https://github.com/THU-MEM/ArchitecturePlanner" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub"><Icon icon={uiIcon('github')} decorative /></a>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.target.files?.[0]
        if (file) void importPlan(file)
        event.target.value = ''
      }} />
    </header>
    {submissionOpen && <section className="submission-panel" aria-label="提交规划到 GitHub">
      <div className="submission-identity"><Icon icon={uiIcon('github')} /><div><h2>提交到 GitHub</h2><p>复制 JSON → 全选粘贴 → Commit / PR</p></div></div>
      <div className="actions"><button type="button" className="primary" disabled={busy || !dirty} onClick={() => void copyAndEdit()}><Icon icon={uiIcon('submit')} decorative />{busy ? '正在复制…' : '复制并前往 GitHub'}</button></div>
      <p className="submission-help">在 GitHub 登录后替换文件内容，直接 Commit 或新建分支提 PR；进入主分支后自动发布。规划及分工会进入公开仓库。</p>
      {copyFailed && <div className="copy-fallback"><label htmlFor="copy-plan">手动复制 JSON</label><textarea id="copy-plan" readOnly rows={6} value={`${JSON.stringify(plan, null, 2)}\n`} onFocus={event => event.currentTarget.select()} /><a href={githubEditUrl} rel="noreferrer">前往 GitHub 编辑</a></div>}
    </section>}
    {savedDraft && <section className="draft-panel" aria-label="本地草稿提示"><p>有一份本地草稿，当前展示已发布规划。</p><button onClick={() => apply(savedDraft)}>恢复本地草稿</button><button type="button" onClick={discardSavedDraft} title="删除此浏览器保存的草稿，刷新后不再提示">删除本地草稿</button></section>}
    {error && <div className="message error" role="alert"><div>{error}</div><button aria-label="关闭错误提示" onClick={() => setError('')}>关闭</button></div>}
    {pendingImport && <section className="replace-panel"><p>将替换当前草稿。尚未导出的修改可能丢失，请先备份。</p><button onClick={exportPlan}>先导出当前规划</button><button className="primary" onClick={() => {
      apply(pendingImport)
      setSelected(pendingImport.modules[0]?.id ?? '')
      setPendingImport(null)
      setNotice('规划已替换并保存为本地草稿。')
    }}>确认替换草稿</button><button onClick={() => setPendingImport(null)}>保留当前草稿</button></section>}
    <nav className="view-tabs" aria-label="规划视图">{tabs.map((item, index) => <button type="button" key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}><Icon icon={uiIcon(tabIcons[index])} decorative />{item}</button>)}</nav>
    {tab !== '技术架构' && <section className="filter-section" aria-label="筛选"><label>搜索模块<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索" /></label>
          <label>架构层<select value={layer} onChange={event => setLayer(event.target.value)}><option value="">全部架构层</option>{[...new Set(plan.modules.map(module => module.layer))].map(id => <option value={id} key={id}>{layers[id] ?? id}</option>)}</select></label>
          <label>Owner 筛选<select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">全部成员</option><option value="unassigned">尚未分配</option>{plan.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    </section>}
    <div className={`workspace-shell ${tab === '技术架构' ? 'current-shell' : ''}`}>
      <main id="workspace" aria-labelledby="view-title" className={`workspace ${tab === '原始架构' ? 'original' : ''}`}>
        {tab === '技术架构' && <CurrentArchitecture plan={plan} onComponent={id => { setSelectedComponent(id); setTab('技术组件'); setQuery(''); setOwnerFilter('') }} onModule={id => { setSelected(id); setTab('分工清单'); setQuery(''); setLayer(''); setOwnerFilter('') }} />}
        {tab === '业务架构' && <>{visible.length ? <ReactFlowProvider><Canvas plan={plan} visible={visible} selected={selected} onSelect={setSelected} onChange={apply} /></ReactFlowProvider> : <div className="empty">没有匹配的模块</div>}</>}
        {tab === '分工清单' && <div className="table-wrap"><table><caption className="sr-only">模块、主负责人及协作负责人</caption><thead><tr><th>模块与职责</th><th>架构层</th><th>主 owner</th><th>协作 owner</th><th>状态</th></tr></thead><tbody>{visible.map(module => <tr key={module.id} className={selected === module.id ? 'selected-row' : ''}><td><button className="module-link" aria-label={`${module.id} ${module.name}`} onClick={() => setSelected(module.id)}><span className="code">{module.id}</span>{module.name}</button><small>{module.summary}</small></td><td>{layers[module.layer] ?? module.layer}</td>{(['primary', 'secondary'] as const).map(role => <td key={role}><div className="owner-cell"><OwnerAvatars owners={module.owners.filter(owner => owner.role === role)} people={plan.people} /><span>{module.owners.filter(owner => owner.role === role).map(owner => plan.people.find(person => person.id === owner.personId)?.name).join('、') || (role === 'primary' ? '未分配' : '—')}</span></div></td>)}<td><span className={`state state-${module.status}`}>{statuses[module.status]}</span></td></tr>)}</tbody></table>{!visible.length && <div className="empty">没有匹配的模块</div>}</div>}
        {tab === '技术组件' && <div className="component-list">{visibleComponents.map(component => <button key={component.id} className={`component-tile ${selectedComponent === component.id ? 'selected-component' : ''}`} aria-label={`${component.id} ${component.name}`} title={component.stack} onClick={() => setSelectedComponent(component.id)}><div className="logo-stack">{componentIcons(component).map(icon => <Icon key={icon.src} icon={icon} />)}</div><strong>{component.name}</strong><div className="tile-owner"><OwnerAvatars owners={component.owners ?? []} people={plan.people} /><span>{component.owners?.filter(owner => owner.role === 'primary').map(owner => plan.people.find(person => person.id === owner.personId)?.name).join('、') || '—'}</span></div></button>)}</div>}
        {tab === '团队成员' && <section className="team-section"><form onSubmit={event => {
          event.preventDefault()
          try { apply(addPerson(plan, personName)); setPersonName('') } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
        }}><label>成员姓名<input value={personName} onChange={event => setPersonName(event.target.value)} maxLength={80} required /></label><button className="primary" type="submit">添加成员</button></form>
          {plan.people.length ? <ul className="team-list">{plan.people.map(person => {
            const profileUrl = githubProfileUrl(person, participants)
            return <li key={person.id}><Avatar person={person} /><strong>{profileUrl ? <a href={profileUrl} target="_blank" rel="noreferrer" title="在新标签页打开 GitHub 主页">{person.name}</a> : person.name}</strong><span>{plan.modules.filter(module => module.owners.some(owner => owner.personId === person.id)).length + plan.components.filter(component => component.owners?.some(owner => owner.personId === person.id)).length}</span></li>
          })}</ul> : <div className="empty"><Icon icon={uiIcon('users')} />添加成员</div>}
        </section>}
        {tab === '原始架构' && <><p className="view-hint">只读基线</p><iframe title="AI-MEM 原始架构" src={`${import.meta.env.BASE_URL}architecture.html`} /></>}
      </main>
      {tab === '技术组件' && component ? <aside className="inspector"><ComponentEditor key={JSON.stringify([component.id, component.owners])} component={component} plan={plan} onApply={apply} onTeam={() => setTab('团队成员')} onModule={id => { setSelected(id); setTab('分工清单'); setQuery(''); setLayer(''); setOwnerFilter('') }} /></aside> : module && tab !== '原始架构' && tab !== '技术架构' && <aside className="inspector"><OwnerEditor key={JSON.stringify([module.id, module.name, module.summary, module.detail, module.status, module.owners, module.components])} module={module} plan={plan} highlightOwners={tab === '业务架构' && visible.some(item => item.id === selected)} onApply={apply} onTeam={() => setTab('团队成员')} onModule={id => { setSelected(id); if (tab !== '业务架构') setTab('分工清单'); setQuery(''); setLayer(''); setOwnerFilter('') }} /></aside>}
      {tab === '业务架构' && !module && <aside className="inspector"><p className="muted">点击卡片查看模块；再次点击取消选中。</p></aside>}
    </div>
    <footer className="sr-only"><p role="status">{notice}</p></footer>
  </div>
}
