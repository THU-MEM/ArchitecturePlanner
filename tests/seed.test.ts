import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePlan } from '../src/plan.ts'

test('the editable baseline preserves every original module, component and technology mapping', () => {
  const html = readFileSync(new URL('../public/architecture.html', import.meta.url), 'utf8')
  const embedded = html.match(/<script id="architecture-data" type="application\/json">([\s\S]*?)<\/script>/)
  assert.ok(embedded, 'original architecture data must remain available')
  const original = JSON.parse(embedded[1])
  const plan = validatePlan(JSON.parse(readFileSync(new URL('../src/seed-plan.json', import.meta.url), 'utf8')))
  assert.equal(plan.modules.length, 24)
  assert.equal(plan.components.length, 65)
  assert.deepEqual(plan.people, [])
  assert.deepEqual(plan.relationships, [])
  assert.deepEqual(plan.modules.map(module => ({
    id: module.id, name: module.name, summary: module.summary, detail: module.detail, layer: module.layer,
  })).sort((a, b) => a.id.localeCompare(b.id)), original.modules.map((module: { id: string; name: string; summary: string; detail: string; layer: string }) => ({
    id: module.id, name: module.name, summary: module.summary, detail: module.detail, layer: module.layer,
  })).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)))
  for (const module of plan.modules) {
    assert.deepEqual(module.components, original.moduleTechnology[module.id], module.id)
    assert.deepEqual(module.owners, [])
  }
  for (const component of plan.components) {
    assert.deepEqual({ name: component.name, detail: component.detail, stack: component.stack }, {
      name: original.components[component.id].title,
      detail: original.components[component.id].detail,
      stack: original.components[component.id].stack ?? '',
    }, component.id)
  }
})
