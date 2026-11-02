import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { drawingLogos, drawingStorageKey } from '../src/drawing-assets.ts'

test('drawing logos reuse the existing local original-color SVG catalog with unique assets', () => {
  assert.notEqual(drawingStorageKey, 'architecture-planner.plan.v1')
  assert.ok(drawingLogos.length >= 12)
  assert.equal(new Set(drawingLogos.map(icon => icon.src)).size, drawingLogos.length)
  for (const icon of drawingLogos) {
    assert.equal(icon.brand, true)
    assert.match(icon.src, /^icons\/[^/]+\.svg$/)
    assert.ok(existsSync(join('public', icon.src)), icon.src)
  }
  for (const label of ['React', 'PostgreSQL', 'Redis', 'Kubernetes']) {
    assert.ok(drawingLogos.some(icon => icon.label === label))
  }
})
