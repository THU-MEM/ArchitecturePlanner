import { useEffect, useId, useState } from 'react'
import { CaptureUpdateAction, convertToExcalidrawElements, mutateElement, newElementWith, sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawArrowElement, ExcalidrawElement, FixedPointBinding } from '@excalidraw/excalidraw/element/types'
import { connectionPoint, connectionSideNames, connectionSides, connectionTarget, isConnectable, nearestConnectionSide } from './drawing-connectors.ts'
import type { ConnectableElement, ConnectionSide, Point } from './drawing-connectors.ts'

type Start = { sourceId: string; side: ConnectionSide }
type Drag = Start & { pointerId: number; point: Point }
type ArrowStyle = Partial<Pick<ExcalidrawArrowElement, 'strokeStyle' | 'startArrowhead' | 'endArrowhead'>>

export default function DrawingConnections({ api, onError }: {
  api: ExcalidrawImperativeAPI | null
  onError: (message: string) => void
}) {
  const [view, setView] = useState<{ elements: readonly ExcalidrawElement[]; state: AppState } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [keyboardStart, setKeyboardStart] = useState<Start | null>(null)
  const [keyboardTarget, setKeyboardTarget] = useState('')
  const markerId = useId()

  useEffect(() => {
    if (!api) return
    setView({ elements: api.getSceneElements(), state: api.getAppState() })
    return api.onChange((elements, state) => setView({ elements, state }))
  }, [api])

  useEffect(() => {
    function cancel() { setDrag(null); setKeyboardStart(null) }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && (drag || keyboardStart)) {
        event.preventDefault()
        event.stopPropagation()
        cancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', cancel)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('blur', cancel) }
  }, [drag, keyboardStart])

  if (!api || !view) return null
  const { elements, state } = view
  const selected = elements.filter(element => state.selectedElementIds[element.id] && !element.isDeleted)
  const component = selected.length === 1 && isConnectable(selected[0]) && state.activeTool.type === 'selection'
    && !state.isResizing && !state.isRotating && !state.editingTextElement ? selected[0] : null
  const arrow = selected.length === 1 && selected[0].type === 'arrow' && !selected[0].locked ? selected[0] : null
  function toScreen(point: Point) {
    const viewport = sceneCoordsToViewportCoords({ sceneX: point.x, sceneY: point.y }, state)
    return { x: viewport.x - state.offsetLeft, y: viewport.y - state.offsetTop }
  }
  function label(element: ConnectableElement) {
    if (typeof element.customData?.logo === 'string') return element.customData.logo
    const text = elements.find(item => item.type === 'text' && element.boundElements?.some(bound => bound.id === item.id))
    if (text?.type === 'text' && text.text) return text.text
    const name = element.type === 'image' ? '图片' : element.type === 'ellipse' ? '椭圆' : element.type === 'diamond' ? '菱形' : '矩形'
    return `${name} ${elements.filter(isConnectable).findIndex(item => item.id === element.id) + 1}`
  }
  function createConnection(start: Start, targetId: string, targetSide?: ConnectionSide) {
    if (!api) return
    const previous = api.getSceneElementsIncludingDeleted()
    const source = previous.find(element => element.id === start.sourceId && isConnectable(element))
    const target = previous.find(element => element.id === targetId && isConnectable(element))
    if (!source || !target || !isConnectable(source) || !isConnectable(target) || source.id === target.id) {
      onError('连线未创建：请选择两个不同且未锁定的方块或 Logo。')
      return
    }
    const from = connectionPoint(source, start.side)
    const to = connectionPoint(target, targetSide ?? nearestConnectionSide(target, from))
    try {
      const definition = {
        type: 'arrow', x: from.x, y: from.y, width: to.x - from.x || 0.01, height: to.y - from.y || 0.01,
        elbowed: true, startArrowhead: null, endArrowhead: 'arrow', roughness: 0,
        strokeColor: '#233d51', strokeWidth: 2, strokeStyle: 'solid', customData: { architectureConnector: true },
      } satisfies Partial<ExcalidrawArrowElement>
      const [created] = convertToExcalidrawElements([definition])
      if (created.type !== 'arrow') throw new Error('编辑器未创建有效箭头')
      const next = previous.map(element => element.id === source.id || element.id === target.id
        ? newElementWith(element, { boundElements: [...(element.boundElements ?? []), { type: 'arrow', id: created.id }] })
        : element)
      // Register first so the native elbow router can resolve both bound shapes, including images.
      api.updateScene({ elements: [...next, created], captureUpdate: CaptureUpdateAction.EVENTUALLY })
      const registered = api.getSceneElements().find(element => element.id === created.id)
      if (registered?.type !== 'arrow') throw new Error('编辑器未注册新箭头')
      const startBinding: FixedPointBinding = { elementId: source.id, focus: 0, gap: 0, fixedPoint: from.fixedPoint }
      const endBinding: FixedPointBinding = { elementId: target.id, focus: 0, gap: 0, fixedPoint: to.fixedPoint }
      mutateElement(registered, { startBinding, endBinding }, false)
      api.updateScene({
        elements: api.getSceneElementsIncludingDeleted(),
        appState: { selectedElementIds: { [created.id]: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
      onError('')
    } catch (error) {
      api.updateScene({ elements: previous, captureUpdate: CaptureUpdateAction.NEVER })
      onError(`连线创建失败，原有图形已保留：${error instanceof Error ? error.message : String(error)}。请重试。`)
    }
    setKeyboardStart(null)
  }
  function changeArrow(changes: ArrowStyle) {
    if (!api || !arrow) return
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted().map(element => element.id === arrow.id && element.type === 'arrow' ? newElementWith(element, changes) : element),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
  }
  const source = drag ? elements.find(element => element.id === drag.sourceId && isConnectable(element)) : null
  const point = drag ? viewportCoordsToSceneCoords({ clientX: drag.point.x, clientY: drag.point.y }, state) : null
  const target = source && point ? connectionTarget(elements, point, source.id, 26 / state.zoom.value) : null
  const from = source && isConnectable(source) && drag ? toScreen(connectionPoint(source, drag.side)) : null
  const to = point ? toScreen(target ? connectionPoint(target, nearestConnectionSide(target, point)) : point) : null
  const targets = elements.filter(isConnectable).filter(element => element.id !== keyboardStart?.sourceId)
  const direction = arrow?.startArrowhead ? arrow.endArrowhead ? 'both' : 'start' : arrow?.endArrowhead ? 'end' : 'none'

  return <div className="drawing-connections">
    {target && <div className="drawing-connect-target" style={{
      left: toScreen({ x: target.x, y: target.y }).x, top: toScreen({ x: target.x, y: target.y }).y,
      width: target.width * state.zoom.value, height: target.height * state.zoom.value, transform: `rotate(${target.angle}rad)`,
    }} />}
    {from && to && <svg className="drawing-connect-preview" aria-hidden="true">
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#176976" strokeWidth="1.5" /></marker></defs>
      <path d={`M ${from.x} ${from.y} L ${(from.x + to.x) / 2} ${from.y} L ${(from.x + to.x) / 2} ${to.y} L ${to.x} ${to.y}`} fill="none" stroke="#176976" strokeWidth="2" strokeDasharray={target ? undefined : '5 5'} markerEnd={`url(#${markerId})`} />
    </svg>}
    {component && connectionSides.map(side => {
      const point = connectionPoint(component, side)
      const screen = toScreen(point)
      return <button type="button" className="drawing-connect-anchor" key={side}
        aria-label={`从${connectionSideNames[side]}侧锚点连线`} title={`从${connectionSideNames[side]}侧拖向另一个方块或 Logo；Enter 选择终点`}
        style={{ left: screen.x + point.normalX * 18, top: screen.y + point.normalY * 18 }}
        onClick={event => {
          if (event.detail === 0) { setKeyboardStart({ sourceId: component.id, side }); setKeyboardTarget('') }
        }}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          setKeyboardStart(null)
          setDrag({ sourceId: component.id, side, pointerId: event.pointerId, point: { x: event.clientX, y: event.clientY } })
        }}
        onPointerMove={event => {
          if (drag?.pointerId === event.pointerId) setDrag({ ...drag, point: { x: event.clientX, y: event.clientY } })
        }}
        onPointerUp={event => {
          if (drag?.pointerId !== event.pointerId) return
          const point = viewportCoordsToSceneCoords(event, api.getAppState())
          const target = connectionTarget(api.getSceneElements(), point, drag.sourceId, 26 / api.getAppState().zoom.value)
          if (target) createConnection(drag, target.id, nearestConnectionSide(target, point))
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8M8 4v8" /></svg>
      </button>
    })}
    {drag && <p className="drawing-connect-hint" role="status">{target ? `松开连接到 ${label(target)}` : '拖向另一个方块或 Logo，Esc 取消'}</p>}
    {keyboardStart && <div className="drawing-connection-settings" role="group" aria-label="选择连线终点">
      <label>终点<select value={keyboardTarget} onChange={event => setKeyboardTarget(event.target.value)} aria-label="连线终点">
        <option value="">选择组件</option>{targets.map(element => <option key={element.id} value={element.id}>{label(element)}</option>)}
      </select></label>
      <button type="button" disabled={!keyboardTarget} onClick={() => createConnection(keyboardStart, keyboardTarget)}>创建连线</button>
      <button type="button" onClick={() => setKeyboardStart(null)}>取消</button>
    </div>}
    {arrow && !drag && !keyboardStart && <div className="drawing-connection-settings" role="group" aria-label="连线设置">
      <label>线型<select aria-label="连线线型" value={arrow.strokeStyle} onChange={event => {
        const value = event.target.value
        if (value === 'solid' || value === 'dashed' || value === 'dotted') changeArrow({ strokeStyle: value })
      }}><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select></label>
      <label>箭头<select aria-label="连线箭头" value={direction} onChange={event => changeArrow({
        startArrowhead: event.target.value === 'both' || event.target.value === 'start' ? 'arrow' : null,
        endArrowhead: event.target.value === 'both' || event.target.value === 'end' ? 'arrow' : null,
      })}><option value="end">单向 · 指向终点</option><option value="both">双向箭头</option><option value="none">无箭头</option><option value="start">仅起点箭头</option></select></label>
    </div>}
  </div>
}
