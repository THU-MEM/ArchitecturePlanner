import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import publishedUrl from './seed-plan.json?url'
import { addPerson, assignOwners, assignComponentOwners, layers, MAX_PLAN_BYTES, statuses, updateModule, validatePlan } from './plan.ts'
import type { Component, Module, Plan } from './plan.ts'
import Canvas from './Canvas.tsx'
import CurrentArchitecture, { ImplementationContext } from './CurrentArchitecture.tsx'
import { SubmissionError, submitPlanPullRequest } from './github.ts'
import Icon, { IconButton } from './Icon.tsx'
import { componentIcons, moduleIcon, uiIcon } from './icons.ts'
import { mergeGitHubParticipants } from './participants.ts'
import './App.css'

const storageKey = 'architecture-planner.plan.v1'
const tabs = ['项目现状', '架构画布', '分工清单', '技术组件', '团队成员', '原始架构'] as const
type Tab = typeof tabs[number]
const tabIcons = ['layer', 'canvas', 'list', 'technology', 'users', 'original']
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

function OwnerFields({ plan, primary, secondary, onPrimary, onSecondary, onTeam }: {
  plan: Plan; primary: string; secondary: string[]; onPrimary: (value: string) => void; onSecondary: (value: string[]) => void; onTeam: () => void
}) {
  return <fieldset><legend>分工</legend>
    <div className="owner-tools"><label>主 owner<select value={primary} onChange={event => {
      onPrimary(event.target.value)
      onSecondary(secondary.filter(id => id !== event.target.value))
    }}><option value="">未分配</option>{plan.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><IconButton icon="users" label="添加团队成员" onClick={onTeam} /></div>
    <div className="owner-options">{plan.people.map(person => <label className="check" key={person.id}>
      <input type="checkbox" aria-label={`协作 owner ${person.name}`} disabled={primary === person.id} checked={secondary.includes(person.id)} onChange={event => onSecondary(event.target.checked ? [...secondary, person.id] : secondary.filter(id => id !== person.id))} />
      <span>{person.name}</span>
    </label>)}</div>
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

function OwnerEditor({ module, plan, onApply, onTeam }: { module: Module; plan: Plan; onApply: (plan: Plan) => void; onTeam: () => void }) {
  const [name, setName] = useState(module.name)
  const [summary, setSummary] = useState(module.summary)
  const [detail, setDetail] = useState(module.detail)
  const [primary, setPrimary] = useState(module.owners.find(owner => owner.role === 'primary')?.personId ?? '')
  const [secondary, setSecondary] = useState(module.owners.filter(owner => owner.role === 'secondary').map(owner => owner.personId))
  const [status, setStatus] = useState(module.status)
  const [references, setReferences] = useState(module.components)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [error, setError] = useState('')
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
    <OwnerFields plan={plan} primary={primary} secondary={secondary} onPrimary={setPrimary} onSecondary={setSecondary} onTeam={onTeam} />
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
  const [tab, setTab] = useState<Tab>('架构画布')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selected, setSelected] = useState('M01')
  const [selectedComponent, setSelectedComponent] = useState('workspace')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(initial.error)
  const [notice, setNotice] = useState('已发布规划 · 修改后通过 PR 提交')
  const [personName, setPersonName] = useState('')
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState<{ plan: Plan; url: string } | null>(null)
  const [branchUrl, setBranchUrl] = useState<string | undefined>()
  const [pendingImport, setPendingImport] = useState<Plan | null>(null)
  const [localSaved, setLocalSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const planRef = useRef(plan)
  function apply(next: Plan) {
    planRef.current = next
    setPlan(next)
    setSavedDraft(null)
    setDirty(true)
    setError('')
    setNotice('已应用 · 本地草稿，尚未提交 PR')
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
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setBranchUrl(undefined)
    const snapshot = planRef.current
    try {
      const url = await submitPlanPullRequest(snapshot, token, description)
      setSubmitted({ plan: snapshot, url })
      setToken('')
      setNotice(planRef.current === snapshot ? 'PR 已创建 · 审核合入后发布' : '提交时的草稿已创建 PR · 合入后发布；后续修改尚未提交')
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
      if (error instanceof SubmissionError) setBranchUrl(error.branchUrl)
    } finally {
      setBusy(false)
    }
  }
  return <div className="app-shell">
    <a className="skip" href="#workspace">跳到规划工作区</a>
    <header className="app-header">
      <div className="wordmark"><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M4 4h9v9H4zm15 0h9v9h-9zM4 19h9v9H4zm15 0h9v9h-9z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 8h6M8 13v6m16-6v6m-11 5h6" fill="none" stroke="currentColor" strokeWidth="2" /></svg><span>ArchitecturePlanner</span></div>
      <div className="header-actions">
        <IconButton icon="upload" label="导入规划" onClick={() => fileRef.current?.click()} /><IconButton icon="download" label="导出规划" onClick={exportPlan} />
        <IconButton icon="submit" label="提交 PR" className="primary" disabled={busy} onClick={() => { setSubmissionOpen(!submissionOpen); setToken('') }} aria-expanded={submissionOpen} />
        <a className="icon-button" href="https://github.com/THU-MEM/ArchitecturePlanner" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub"><Icon icon={uiIcon('github')} decorative /></a>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.target.files?.[0]
        if (file) void importPlan(file)
        event.target.value = ''
      }} />
    </header>
    {submissionOpen && <form className="submission-panel" aria-label="提交规划 PR" onSubmit={submit}>
      <div className="submission-identity"><Icon icon={uiIcon('github')} /><div><h2>提交 PR</h2><p>审核合入后发布。Token 仅留本页。</p></div></div>
      <label>修改说明<input disabled={busy} value={description} onChange={event => setDescription(event.target.value)} maxLength={120} placeholder="调整模块分工" required /></label>
      <label>GitHub Token<input type="password" disabled={busy} autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value)} maxLength={512} required /></label>
      <div className="actions"><button type="submit" className="primary" disabled={busy || !dirty || !token.trim() || !description.trim() || submitted?.plan === plan}><Icon icon={uiIcon('submit')} decorative />{busy ? '正在提交…' : '创建 Pull Request'}</button>{submitted && <a href={submitted.url} target="_blank" rel="noreferrer">查看 PR</a>}</div>
      <details className="submission-help"><summary>GitHub 授权与公开范围</summary><p>需要本仓库写权限。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">创建细粒度 Token</a>，仅选择 ArchitecturePlanner，授予 Contents、Pull requests 读写权限；组织可能要求审批。Token 不能限制到单个文件。提交的规划、参与者昵称和分工将进入公开仓库，不要填写凭证或其他个人资料。</p></details>
    </form>}
    {savedDraft && <section className="draft-panel"><p>有一份本地草稿，当前展示已发布规划。</p><button onClick={() => apply(savedDraft)}>恢复本地草稿</button></section>}
    {error && <div className="message error" role="alert"><div>{error}{branchUrl && <p><a href={branchUrl} target="_blank" rel="noreferrer">检查分支 / 手动创建 PR</a></p>}</div><button aria-label="关闭错误提示" onClick={() => setError('')}>关闭</button></div>}
    {pendingImport && <section className="replace-panel"><p>将替换当前草稿。尚未导出的修改可能丢失，请先备份。</p><button onClick={exportPlan}>先导出当前规划</button><button className="primary" onClick={() => {
      apply(pendingImport)
      setSelected(pendingImport.modules[0]?.id ?? '')
      setPendingImport(null)
      setNotice('规划已替换并保存为本地草稿。')
    }}>确认替换草稿</button><button onClick={() => setPendingImport(null)}>保留当前草稿</button></section>}
    <div className="workspace-heading"><div><h1>架构规划台</h1><p>{plan.name}</p></div><button className="current-entry" aria-label="查看 SSO 与 MEM-AI 现状" onClick={() => setTab('项目现状')}><Icon icon={uiIcon('layer')} decorative />SSO · MEM-AI</button><div className="progress-label"><strong>{assigned}/{plan.modules.length + plan.components.length}</strong><span>已分配</span></div></div>
    <div className={`workspace-shell ${tab === '项目现状' ? 'current-shell' : ''}`}>
      <aside className="sidebar">
        <nav aria-label="规划视图">{tabs.map((item, index) => <IconButton key={item} icon={tabIcons[index]} label={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)} />)}</nav>
        {tab !== '项目现状' && <div className="filter-section"><h2 className="sr-only">筛选</h2><label>搜索模块<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索" /></label>
          <label>架构层<select value={layer} onChange={event => setLayer(event.target.value)}><option value="">全部架构层</option>{[...new Set(plan.modules.map(module => module.layer))].map(id => <option value={id} key={id}>{layers[id] ?? id}</option>)}</select></label>
          <label>Owner 筛选<select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">全部成员</option><option value="unassigned">尚未分配</option>{plan.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        </div>}
        <div className="privacy-note"><Icon icon={uiIcon(dirty ? 'lock' : 'github')} decorative /><strong>{dirty ? '本地草稿' : '已发布规划'}</strong></div>
      </aside>
      <main id="workspace" className={`workspace ${tab === '原始架构' ? 'original' : ''}`}>
        <div className="view-heading"><h2>{tab}</h2>{tab !== '项目现状' && <span>{tab === '团队成员' ? plan.people.length : tab === '技术组件' ? visibleComponents.length : visible.length}</span>}</div>
        {tab === '项目现状' && <CurrentArchitecture plan={plan} onComponent={id => { setSelectedComponent(id); setTab('技术组件'); setQuery(''); setOwnerFilter('') }} onModule={id => { setSelected(id); setTab('分工清单'); setQuery(''); setLayer(''); setOwnerFilter('') }} />}
        {tab === '架构画布' && <>{visible.length ? <ReactFlowProvider><Canvas plan={plan} visible={visible} selected={selected} onSelect={setSelected} onChange={apply} /></ReactFlowProvider> : <div className="empty">没有匹配的模块</div>}</>}
        {tab === '分工清单' && <div className="table-wrap"><table><caption className="sr-only">模块、主负责人及协作负责人</caption><thead><tr><th>模块与职责</th><th>架构层</th><th>主 owner</th><th>协作 owner</th><th>状态</th></tr></thead><tbody>{visible.map(module => <tr key={module.id} className={selected === module.id ? 'selected-row' : ''}><td><button className="module-link" aria-label={`${module.id} ${module.name}`} onClick={() => setSelected(module.id)}><span className="code">{module.id}</span>{module.name}</button><small>{module.summary}</small></td><td>{layers[module.layer] ?? module.layer}</td><td>{module.owners.filter(owner => owner.role === 'primary').map(owner => plan.people.find(person => person.id === owner.personId)?.name).join('、') || '未分配'}</td><td>{module.owners.filter(owner => owner.role === 'secondary').map(owner => plan.people.find(person => person.id === owner.personId)?.name).join('、') || '—'}</td><td><span className={`state state-${module.status}`}>{statuses[module.status]}</span></td></tr>)}</tbody></table>{!visible.length && <div className="empty">没有匹配的模块</div>}</div>}
        {tab === '技术组件' && <div className="component-list">{visibleComponents.map(component => <button key={component.id} className={`component-tile ${selectedComponent === component.id ? 'selected-component' : ''}`} aria-label={`${component.id} ${component.name}`} title={component.stack} onClick={() => setSelectedComponent(component.id)}><div className="logo-stack">{componentIcons(component).map(icon => <Icon key={icon.src} icon={icon} />)}</div><strong>{component.name}</strong><span className="tile-owner">{component.owners?.filter(owner => owner.role === 'primary').map(owner => plan.people.find(person => person.id === owner.personId)?.name).join('、') || '—'}</span></button>)}</div>}
        {tab === '团队成员' && <section className="team-section"><form onSubmit={event => {
          event.preventDefault()
          try { apply(addPerson(plan, personName)); setPersonName('') } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
        }}><label>成员姓名<input value={personName} onChange={event => setPersonName(event.target.value)} maxLength={80} required /></label><button className="primary" type="submit">添加成员</button></form>
          {plan.people.length ? <ul className="team-list">{plan.people.map(person => <li key={person.id}><span className="avatar" aria-hidden="true">{person.name.slice(0, 1)}</span><strong>{person.name}</strong><span>{plan.modules.filter(module => module.owners.some(owner => owner.personId === person.id)).length + plan.components.filter(component => component.owners?.some(owner => owner.personId === person.id)).length}</span></li>)}</ul> : <div className="empty"><Icon icon={uiIcon('users')} />添加成员</div>}
        </section>}
        {tab === '原始架构' && <><p className="view-hint">只读基线</p><iframe title="AI-MEM 原始架构" src={`${import.meta.env.BASE_URL}architecture.html`} /></>}
      </main>
      {tab === '技术组件' && component ? <aside className="inspector"><ComponentEditor key={JSON.stringify([component.id, component.owners])} component={component} plan={plan} onApply={apply} onTeam={() => setTab('团队成员')} onModule={id => { setSelected(id); setTab('分工清单'); setQuery(''); setLayer(''); setOwnerFilter('') }} /></aside> : module && tab !== '原始架构' && tab !== '项目现状' && <aside className="inspector"><OwnerEditor key={JSON.stringify([module.id, module.name, module.summary, module.detail, module.status, module.owners, module.components])} module={module} plan={plan} onApply={apply} onTeam={() => setTab('团队成员')} /></aside>}
    </div>
    <footer><p role="status">{notice}</p></footer>
  </div>
}
