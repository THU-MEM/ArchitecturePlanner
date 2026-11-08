import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CaptureUpdateAction, Excalidraw, MainMenu, convertToExcalidrawElements,
  exportToBlob, getDataURL, loadFromBlob, serializeAsJSON, viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, ExcalidrawProps } from '@excalidraw/excalidraw/types'
import type { FileId } from '@excalidraw/excalidraw/element/types'
import { drawingCategories, drawingLogos, drawingStorageKey, filterDrawingLogos } from './drawing-assets.ts'
import type { IconReference } from './icons.ts'
import Icon from './Icon.tsx'
import DrawingConnections from './DrawingConnections.tsx'
import '@excalidraw/excalidraw/index.css'
import './ArchitectureCanvas.css'

const logoDragType = 'application/x-architecture-planner-logo'
type RestoredScene = Awaited<ReturnType<typeof loadFromBlob>>
const blankScene: ExcalidrawInitialDataState = {
  appState: {
    viewBackgroundColor: '#ffffff', currentItemFontFamily: 2,
    currentItemRoughness: 0, currentItemStrokeColor: '#233d51',
  },
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function ArchitectureCanvas() {
  const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [activeTool, setActiveTool] = useState('selection')
  const [paletteOpen, setPaletteOpen] = useState(() => window.innerWidth > 900)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [elementCount, setElementCount] = useState(0)
  const [pendingImport, setPendingImport] = useState<RestoredScene | null>(null)
  const [savedRaw, setSavedRaw] = useState('')
  const lastSaved = useRef('')
  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pastePoint = useRef<{ clientX: number; clientY: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const raw = localStorage.getItem(drawingStorageKey)
        if (!cancelled) setSavedRaw(raw ?? '')
        const data = raw ? await loadFromBlob(new Blob([raw], { type: 'application/json' }), null, null) : blankScene
        if (!cancelled) {
          lastSaved.current = raw ?? ''
          setInitialData(data)
          setLoadError('')
        }
      } catch (error) {
        if (!cancelled) setLoadError(`画布草稿读取失败：${error instanceof Error ? error.message : String(error)}。原草稿未覆盖，请先下载备份或重试。`)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [attempt])

  const onChange = useCallback<NonNullable<ExcalidrawProps['onChange']>>((elements, state, files) => {
    setActiveTool(state.activeTool.type)
    setElementCount(elements.filter(element => !element.isDeleted).length)
    try {
      const json = serializeAsJSON(elements, state, files, 'local')
      if (json !== lastSaved.current) {
        localStorage.setItem(drawingStorageKey, json)
        lastSaved.current = json
      }
      setSaveError('')
    } catch (error) {
      setSaveError(`画布自动保存失败：${error instanceof Error ? error.message : String(error)}。请下载画布文件备份，当前内容仍可编辑和导出。`)
    }
  }, [])

  useEffect(() => {
    if (!api) return
    const editor = api
    let cancelled = false
    let pasting = false
    async function insertClipboard(images: File[], text: string) {
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) throw new Error('绘制区域尚未就绪')
      const point = pastePoint.current
      const position = viewportCoordsToSceneCoords(point && point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom
        ? point : { clientX: rect.left + rect.width / 2, clientY: rect.top + Math.min(rect.height, window.innerHeight - rect.top) / 2 }, editor.getAppState())
      const files = await Promise.all(images.map(async file => {
        if (file.size > 20 * 1024 * 1024) throw new Error('每张图片不能超过 20 MiB')
        const image = new Image()
        image.src = await getDataURL(file)
        await image.decode()
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片没有有效尺寸')
        const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('浏览器无法读取图片')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const id = crypto.randomUUID() as FileId
        return { id, dataURL: await getDataURL(await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片转换失败')), 'image/png'))), mimeType: 'image/png' as const, created: Date.now(), width: canvas.width, height: canvas.height }
      }))
      if (cancelled) return
      const state = editor.getAppState()
      const elements = files.length ? files.flatMap((file, index) => {
        const scale = Math.min(1, 480 / Math.max(file.width, file.height))
        return convertToExcalidrawElements([{ type: 'image', fileId: file.id, status: 'saved', x: position.x + index * 24, y: position.y + index * 24, width: file.width * scale, height: file.height * scale, scale: [1, 1] }])
      }) : convertToExcalidrawElements([{
        type: 'text', text, x: position.x, y: position.y,
        fontFamily: state.currentItemFontFamily, fontSize: state.currentItemFontSize, strokeColor: state.currentItemStrokeColor,
      }])
      editor.updateScene({
        elements: [...editor.getSceneElementsIncludingDeleted(), ...elements],
        appState: { selectedElementIds: Object.fromEntries(elements.map(element => [element.id, true])) },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
      if (files.length) editor.addFiles(files)
      editor.setActiveTool({ type: 'selection' })
      stageRef.current?.querySelector<HTMLElement>('.excalidraw')?.focus()
      if (window.innerWidth <= 900) setPaletteOpen(false)
      setError('')
    }
    function paste(event: ClipboardEvent) {
      const target = document.activeElement
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      const clipboard = event.clipboardData
      if (!clipboard) return
      const images = Array.from(clipboard.files).filter(file => file.type.startsWith('image/'))
      const text = clipboard.getData('text/plain')
      // Keep native scene copy/paste, including its bindings and image files.
      if (!images.length && /"type"\s*:\s*"(?:excalidraw|excalidraw-api)\/clipboard"/.test(text)) return
      if (!images.length && !text) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (pasting) { setError('正在粘贴图片，请稍后再次粘贴。'); return }
      pasting = true
      setBusy(true)
      void insertClipboard(images, text).catch((error: unknown) => {
        if (!cancelled) setError(`粘贴失败，已有内容未替换：${error instanceof Error ? error.message : String(error)}。请检查图片格式或重新复制。`)
      }).finally(() => {
        pasting = false
        if (!cancelled) setBusy(false)
      })
    }
    document.addEventListener('paste', paste, true)
    return () => { cancelled = true; document.removeEventListener('paste', paste, true) }
  }, [api])

  function saveFile() {
    if (!api) return
    try {
      download(new Blob([serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local')], { type: 'application/json' }), 'architecture-canvas.excalidraw')
      setError('')
    } catch (error) {
      setError(`画布文件导出失败：${error instanceof Error ? error.message : String(error)}。请重试。`)
    }
  }

  async function exportPNG() {
    if (!api || !elementCount) return
    setBusy(true)
    setError('')
    try {
      const blob = await exportToBlob({
        elements: api.getSceneElements(), files: api.getFiles(),
        appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false },
        mimeType: 'image/png', exportPadding: 24, maxWidthOrHeight: 4096,
      })
      download(blob, 'architecture-canvas.png')
    } catch (error) {
      setError(`PNG 导出失败：${error instanceof Error ? error.message : String(error)}。请重试，或先下载画布文件备份。`)
    } finally {
      setBusy(false)
    }
  }

  function replaceScene(data: RestoredScene) {
    if (!api) return
    api.resetScene()
    api.updateScene({ elements: data.elements, appState: data.appState, captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    api.addFiles(Object.values(data.files))
    api.scrollToContent(undefined, { fitToViewport: true })
    setPendingImport(null)
  }

  async function importFile(file: File) {
    if (!api) return
    setBusy(true)
    setError('')
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MiB')
      const data = await loadFromBlob(file, null, null)
      if (api.getSceneElements().length) setPendingImport(data)
      else replaceScene(data)
    } catch (error) {
      setError(`画布导入失败，现有内容未修改：${error instanceof Error ? error.message : String(error)}。请选择有效的 .excalidraw 文件。`)
    } finally {
      setBusy(false)
    }
  }

  async function insertLogo(icon: IconReference, point?: { clientX: number; clientY: number }) {
    if (!api || busy) return
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const position = viewportCoordsToSceneCoords(point ?? { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }, api.getAppState())
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${icon.src}`)
      if (!response.ok) throw new Error(`SVG 读取失败（${response.status}）`)
      const svg = await response.text()
      const dataURL = await getDataURL(new Blob([svg], { type: 'image/svg+xml' }))
      const image = new Image()
      image.src = dataURL
      await image.decode()
      const scale = 80 / Math.max(image.naturalWidth, image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const fileId = `architecture-logo-${icon.src}` as FileId
      const elements = convertToExcalidrawElements([{
        type: 'image', fileId, status: 'saved', x: position.x - width / 2, y: position.y - height / 2,
        width, height, scale: [1, 1], customData: { logo: icon.label },
      }])
      api.updateScene({
        elements: [...api.getSceneElements(), ...elements],
        appState: { selectedElementIds: Object.fromEntries(elements.map(element => [element.id, true])) },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
      api.addFiles([{ id: fileId, dataURL, mimeType: 'image/svg+xml', created: Date.now() }])
      api.setActiveTool({ type: 'selection' })
      if (window.innerWidth <= 900) setPaletteOpen(false)
    } catch (error) {
      setError(`插入 ${icon.label} 失败：${error instanceof Error ? error.message : String(error)}。请重试。`)
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <section className="drawing-recovery" aria-label="画布恢复">
    <p className="error" role="alert">{loadError}</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>重试读取画布</button>
    {savedRaw && <button type="button" onClick={() => download(new Blob([savedRaw], { type: 'application/json' }), 'architecture-canvas-recovery.excalidraw')}>下载原始草稿备份</button>}
    <button type="button" onClick={() => {
      try {
        localStorage.removeItem(drawingStorageKey)
        lastSaved.current = ''
        setLoadError('')
        setInitialData(blankScene)
      } catch (error) {
        setLoadError(`无法删除画布草稿：${error instanceof Error ? error.message : String(error)}。请检查浏览器存储权限后重试。`)
      }
    }}>舍弃此画布草稿并新建</button>
  </section>
  if (!initialData) return <p className="drawing-loading" role="status">正在读取架构画布…</p>

  const logos = filterDrawingLogos(search, category)
  const logoGroups = Object.entries(drawingCategories).map(([id, name]) => ({
    id, name, icons: logos.filter(icon => icon.category === id),
  })).filter(group => group.icons.length)
  return <section className="drawing-workspace" aria-label="自由架构画布">
    <div className="drawing-toolbar">
      <button type="button" disabled={!api || busy} aria-pressed={activeTool === 'freedraw'} title="自由画笔：鼠标拖拽、手指或手写笔画轨迹（P）" onClick={() => {
        api?.setActiveTool({ type: 'freedraw' })
        if (window.innerWidth <= 900) setPaletteOpen(false)
        stageRef.current?.querySelector<HTMLElement>('.excalidraw')?.focus()
      }}>画笔</button>
      <button type="button" disabled={!api || busy} aria-pressed={activeTool === 'selection'} title="选择、移动图形，退出画笔（V）" onClick={() => {
        api?.setActiveTool({ type: 'selection' })
        stageRef.current?.querySelector<HTMLElement>('.excalidraw')?.focus()
      }}>选择</button>
      <button type="button" aria-expanded={paletteOpen} aria-controls="drawing-logos" onClick={() => setPaletteOpen(value => !value)}>技术 Logo</button>
      <button type="button" disabled={!api || busy} onClick={saveFile}>下载画布文件</button>
      <button type="button" disabled={!api || busy} onClick={() => fileRef.current?.click()}>导入画布文件</button>
      <button type="button" className="primary" disabled={!api || !elementCount || busy} onClick={() => void exportPNG()}>{busy ? '正在处理…' : '导出 PNG'}</button>
      <span className="drawing-save-status" role="status">{saveError ? '自动保存失败，请下载备份' : '仅本机自动保存 · 不随规划提交'} · {elementCount} 个元素</span>
      <input ref={fileRef} type="file" accept=".excalidraw,.json,application/json" hidden aria-label="导入架构画布文件" onChange={event => {
        const file = event.target.files?.[0]
        if (file) void importFile(file)
        event.target.value = ''
      }} />
    </div>
    {(error || saveError) && <div className="drawing-error error" role="alert">{error && <p>{error}</p>}{saveError && <p>{saveError}</p>}</div>}
    {pendingImport && <div className="drawing-confirm" role="region" aria-label="替换架构画布">
      <p>导入会替换当前画布，建议先下载画布文件备份。</p>
      <button type="button" onClick={saveFile}>下载当前画布</button>
      <button type="button" onClick={() => replaceScene(pendingImport)}>确认替换画布</button>
      <button type="button" onClick={() => setPendingImport(null)}>保留当前画布</button>
    </div>}
    <div className="drawing-body">
      <div className="drawing-stage" ref={stageRef} aria-label="框图与涂鸦绘制区域" title="Ctrl+V / ⌘V：粘贴图片或创建文本框"
        onPointerMoveCapture={event => {
          if (event.target instanceof HTMLCanvasElement) pastePoint.current = { clientX: event.clientX, clientY: event.clientY }
        }}
        onDragOverCapture={event => {
          if (event.dataTransfer.types.includes(logoDragType)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' }
        }}
        onDropCapture={event => {
          const src = event.dataTransfer.getData(logoDragType)
          if (!src) return
          event.preventDefault()
          event.stopPropagation()
          const icon = drawingLogos.find(item => item.src === src)
          if (icon) void insertLogo(icon, { clientX: event.clientX, clientY: event.clientY })
          else setError('无法识别拖入的 Logo，请从技术 Logo 面板重新选择。')
        }}>
        <Excalidraw initialData={initialData} excalidrawAPI={setApi} onChange={onChange}
          langCode="zh-CN" theme="light" handleKeyboardGlobally={false} aiEnabled={false} validateEmbeddable={false}
          UIOptions={{ canvasActions: { export: false, loadScene: false, saveToActiveFile: false, saveAsImage: false, toggleTheme: false } }}>
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
        {api && <DrawingConnections api={api} onError={setError} />}
      </div>
      {paletteOpen && <aside className="drawing-logos" id="drawing-logos" aria-label="技术 Logo 素材">
        <div className="section-title"><h3>技术 Logo</h3><button type="button" onClick={() => setPaletteOpen(false)} aria-label="关闭 Logo 素材">关闭</button></div>
        <p>点击或拖入画布，保留透明背景，可缩放、移动。</p>
        <label>搜索 Logo<input type="search" value={search} onChange={event => { setSearch(event.target.value); setCollapsedGroups([]) }} placeholder="ECS、对象存储、PostgreSQL…" /></label>
        <label className="drawing-category">素材分类<select aria-label="素材分类" value={category} onChange={event => { setCategory(event.target.value); setCollapsedGroups([]) }}>
          <option value="">全部分类</option>
          {Object.entries(drawingCategories).map(([id, name]) => <option key={id} value={id}>{name}（{drawingLogos.filter(icon => icon.category === id).length}）</option>)}
        </select></label>
        <div className="drawing-logo-count" role="status">{logos.length} / {drawingLogos.length} 项 · SVG</div>
        <div className="drawing-group-actions">
          <button type="button" disabled={!logoGroups.length} onClick={() => setCollapsedGroups([])}>展开全部分组</button>
          <button type="button" disabled={!logoGroups.length} onClick={() => setCollapsedGroups(logoGroups.map(group => group.id))}>收起全部分组</button>
        </div>
        {category === 'alibaba' && <p className="drawing-service-note">产品图为服务示意，非官方图标；品牌 Logo 单独标记。</p>}
        <div className="drawing-logo-results">
        {logoGroups.map(group => <section className="drawing-logo-group" key={group.id} aria-label={group.name}>
          <h4><button type="button" className="drawing-group-heading" aria-expanded={!collapsedGroups.includes(group.id)} aria-controls={`drawing-group-${group.id}`} onClick={() => setCollapsedGroups(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5" /></svg>
            <span>{group.name}</span><small>{group.icons.length}</small>
          </button></h4>
          <div id={`drawing-group-${group.id}`} hidden={collapsedGroups.includes(group.id)}>
          {group.id === 'alibaba' && category !== 'alibaba' && <p className="drawing-service-note">含非官方服务示意；品牌 Logo 单独标记。</p>}
          <div className="drawing-logo-grid">{group.icons.map(icon => <button type="button" key={icon.src} draggable={!busy} disabled={!api || busy} aria-label={`插入 ${icon.label} Logo`} title={`${icon.label} · ${icon.kind === 'service' ? 'Lucide 服务示意，非官方图标' : '品牌 Logo'} · 拖拽或点击插入`}
          onDragStart={event => { event.dataTransfer.setData(logoDragType, icon.src); event.dataTransfer.effectAllowed = 'copy' }}
          onClick={() => void insertLogo(icon)}><Icon icon={icon} decorative loading="lazy" /><span>{icon.label}</span><small>{icon.kind === 'service' ? '服务示意' : '品牌 Logo'}</small></button>)}</div>
          </div>
        </section>)}
        {!logos.length && <p>没有匹配的 Logo，请换个关键词。</p>}
        </div>
      </aside>}
    </div>
  </section>
}
