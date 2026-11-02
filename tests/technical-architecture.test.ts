import test from 'node:test'
import assert from 'node:assert/strict'
import { runtimeSnapshot, technicalFacts, technicalFlows } from '../src/technical-architecture.ts'
import { layoutGraph } from '../src/graph-layout.ts'

test('technical facts and relationships have unique IDs and complete evidence', () => {
  const ids = new Set(technicalFacts.map(fact => fact.id))
  assert.equal(ids.size, technicalFacts.length)
  assert.equal(new Set(technicalFlows.map(flow => flow.id)).size, technicalFlows.length)
  assert.equal(runtimeSnapshot.pods, runtimeSnapshot.running + runtimeSnapshot.pending)
  for (const fact of technicalFacts) {
    assert.ok(fact.observation && fact.detail && fact.sources.length, fact.id)
    if (fact.runtime === 'ready') assert.ok(fact.sources.some(source => source.label.includes('SSH')), fact.id)
  }
  for (const flow of technicalFlows) {
    assert.ok(ids.has(flow.source) && ids.has(flow.target), flow.id)
    assert.ok(flow.detail, flow.id)
    if (flow.evidence === 'observed') {
      assert.ok(technicalFacts.filter(fact => fact.id === flow.source || fact.id === flow.target).every(fact => fact.runtime === 'ready' || fact.runtime === 'blocked'), flow.id)
    }
  }
  assert.equal(technicalFacts.find(fact => fact.id === 'mem-gateway')!.runtime, 'blocked')
  assert.match(technicalFacts.find(fact => fact.id === 'mem-gateway')!.observation, /ErrImageNeverPull/)
  assert.equal(technicalFacts.find(fact => fact.id === 'sso-hub')!.runtime, 'not-observed')
  assert.ok(!technicalFlows.some(flow => flow.evidence === 'observed' && ['template-database', 'sso-redis', 'sso-minio', 'llmwiki', 'case-management'].includes(flow.target)))
})

test('the full technical topology lays out every component and routes every edge', async () => {
  const sizes = Object.fromEntries(technicalFacts.map(fact => [fact.id, { width: 270, height: 142 }]))
  const layout = await layoutGraph(technicalFacts, technicalFlows, sizes)
  assert.equal(Object.keys(layout.positions).length, technicalFacts.length)
  assert.equal(Object.keys(layout.routes).length, technicalFlows.length)
  for (const fact of technicalFacts) {
    assert.ok(Number.isFinite(layout.positions[fact.id].x) && Number.isFinite(layout.positions[fact.id].y))
  }
})
