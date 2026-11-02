import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutGraph } from '../src/graph-layout.ts'
import seed from '../src/seed-plan.json' with { type: 'json' }

test('automatic topology layout is deterministic, separates nodes and routes every dependency around other modules', async () => {
  const sizes = Object.fromEntries(seed.modules.map(module => [module.id, { width: 250, height: 170 }]))
  const layout = await layoutGraph(seed.modules, seed.relationships, sizes)
  assert.deepEqual(layout, await layoutGraph(seed.modules, seed.relationships, sizes))
  assert.equal(Object.keys(layout.positions).length, seed.modules.length)
  assert.equal(Object.keys(layout.routes).length, seed.relationships.length)
  for (const [id, position] of Object.entries(layout.positions)) {
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y))
    for (const [otherId, other] of Object.entries(layout.positions)) {
      if (id === otherId) continue
      assert.ok(position.x + 250 <= other.x || other.x + 250 <= position.x || position.y + 170 <= other.y || other.y + 170 <= position.y, `${id} overlaps ${otherId}`)
    }
  }
  for (const edge of seed.relationships) {
    const points = layout.routes[edge.id]
    assert.ok(points.length >= 2)
    assert.deepEqual(points[0], { x: layout.positions[edge.source].x + 250, y: layout.positions[edge.source].y + 85 })
    assert.deepEqual(points.at(-1), { x: layout.positions[edge.target].x, y: layout.positions[edge.target].y + 85 })
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      assert.ok(a.x === b.x || a.y === b.y)
      for (const [id, node] of Object.entries(layout.positions)) {
        if (id === edge.source || id === edge.target) continue
        const crosses = a.x === b.x
          ? a.x > node.x && a.x < node.x + 250 && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + 170
          : a.y > node.y && a.y < node.y + 170 && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + 250
        assert.ok(!crosses, `${edge.id} crosses ${id}`)
      }
    }
  }
})

test('layout supports feedback cycles, disconnected modules and measured variable node heights', async () => {
  const modules = [{ id: 'a' }, { id: 'b' }, { id: 'isolated' }]
  const relationships = [{ id: 'ab', source: 'a', target: 'b' }, { id: 'ba', source: 'b', target: 'a' }]
  const layout = await layoutGraph(modules, relationships, { a: { width: 250, height: 600 }, b: { width: 250, height: 120 } })
  assert.equal(Object.keys(layout.positions).length, 3)
  assert.equal(Object.keys(layout.routes).length, 2)
  assert.notDeepEqual(layout.routes.ab, [...layout.routes.ba].reverse())
})
