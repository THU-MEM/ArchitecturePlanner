import test from 'node:test'
import assert from 'node:assert/strict'
import { connectionPoint, connectionSides, nearestConnectionSide } from '../src/drawing-connectors.ts'

test('four connection ports use shape edge midpoints and stable native fixed-point bindings', () => {
  const shape = { x: 100, y: 200, width: 160, height: 80, angle: 0 }
  assert.deepEqual(connectionSides.map(side => {
    const { x, y, fixedPoint } = connectionPoint(shape, side)
    return [x, y, fixedPoint]
  }), [
    [180, 200, [0.5, 0]], [260, 240, [1, 0.5]], [180, 280, [0.5, 1]], [100, 240, [0, 0.5]],
  ])
  assert.equal(nearestConnectionSide(shape, { x: 300, y: 240 }), 'right')
  assert.equal(nearestConnectionSide(shape, { x: 180, y: 180 }), 'top')
})

test('ports and outward normals rotate around the center without changing the saved binding ratio', () => {
  const shape = { x: 100, y: 200, width: 160, height: 80, angle: Math.PI / 2 }
  const point = connectionPoint(shape, 'right')
  assert.ok(Math.abs(point.x - 180) < 1e-8)
  assert.ok(Math.abs(point.y - 320) < 1e-8)
  assert.ok(Math.abs(point.normalX) < 1e-8)
  assert.ok(Math.abs(point.normalY - 1) < 1e-8)
  assert.deepEqual(point.fixedPoint, [1, 0.5])
  assert.equal(nearestConnectionSide(shape, { x: 180, y: 350 }), 'right')
})
