import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ConnectableElement = Extract<ExcalidrawElement, { type: 'rectangle' | 'diamond' | 'ellipse' | 'image' }>
export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left'
export type Point = { x: number; y: number }
type Geometry = { x: number; y: number; width: number; height: number; angle: number }
export const connectionSides: ConnectionSide[] = ['top', 'right', 'bottom', 'left']
export const connectionSideNames = { top: '上', right: '右', bottom: '下', left: '左' }

export function isConnectable(element: ExcalidrawElement): element is ConnectableElement {
  return !element.isDeleted && !element.locked && element.width > 0 && element.height > 0
    && ['rectangle', 'diamond', 'ellipse', 'image'].includes(element.type)
}

export function connectionPoint(element: Geometry, side: ConnectionSide) {
  const fixedPoint: [number, number] = side === 'top' ? [0.5, 0] : side === 'right' ? [1, 0.5] : side === 'bottom' ? [0.5, 1] : [0, 0.5]
  const dx = (fixedPoint[0] - 0.5) * element.width
  const dy = (fixedPoint[1] - 0.5) * element.height
  const cos = Math.cos(element.angle)
  const sin = Math.sin(element.angle)
  const normalX = side === 'left' ? -1 : side === 'right' ? 1 : 0
  const normalY = side === 'top' ? -1 : side === 'bottom' ? 1 : 0
  return {
    x: element.x + element.width / 2 + dx * cos - dy * sin,
    y: element.y + element.height / 2 + dx * sin + dy * cos,
    normalX: normalX * cos - normalY * sin,
    normalY: normalX * sin + normalY * cos,
    fixedPoint,
  }
}

export function nearestConnectionSide(element: Geometry, point: Point): ConnectionSide {
  return connectionSides.reduce((closest, side) => {
    const a = connectionPoint(element, closest)
    const b = connectionPoint(element, side)
    return Math.hypot(point.x - b.x, point.y - b.y) < Math.hypot(point.x - a.x, point.y - a.y) ? side : closest
  })
}

export function connectionTarget(elements: readonly ExcalidrawElement[], point: Point, sourceId: string, tolerance: number): ConnectableElement | undefined {
  return elements.filter(isConnectable).reverse().find(element => {
    if (element.id === sourceId) return false
    const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
    const dx = point.x - center.x
    const dy = point.y - center.y
    const cos = Math.cos(element.angle)
    const sin = Math.sin(element.angle)
    const x = Math.abs(dx * cos + dy * sin) / (element.width / 2)
    const y = Math.abs(-dx * sin + dy * cos) / (element.height / 2)
    const inside = element.type === 'ellipse' ? x * x + y * y <= 1 : element.type === 'diamond' ? x + y <= 1 : x <= 1 && y <= 1
    return inside || connectionSides.some(side => {
      const anchor = connectionPoint(element, side)
      return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= tolerance
    })
  })
}
