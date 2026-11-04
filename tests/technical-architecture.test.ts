import test from 'node:test'
import assert from 'node:assert/strict'
import { deploymentFactIds, runtimeSnapshot, technicalDomains, technicalFacts, technicalFlows } from '../src/technical-architecture.ts'
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
  assert.equal(runtimeSnapshot.pending, 0)
  assert.equal(runtimeSnapshot.running, 19)
  assert.equal(technicalFacts.find(fact => fact.id === 'mem-gateway')!.runtime, 'ready')
  assert.match(technicalFacts.find(fact => fact.id === 'mem-gateway')!.observation, /Deployment 1\/1/)
  assert.equal(technicalFacts.find(fact => fact.id === 'sso-hub')!.runtime, 'not-observed')
  const database = technicalFacts.find(fact => fact.id === 'mem-postgres')!
  assert.equal(database.runtime, 'ready')
  assert.equal(database.stack, 'PostgreSQL · SQL')
  assert.match(database.detail, /弃用 SQLite/)
  assert.match(database.observation, /数据库侧可见 1 个/)
  assert.ok(!technicalFacts.some(fact => fact.id === 'mem-sqlite'))
  assert.equal(technicalFlows.find(flow => flow.id === 'gateway-store')!.evidence, 'source')
  assert.ok(!technicalFlows.some(flow => flow.evidence === 'observed' && ['template-database', 'sso-redis', 'sso-minio', 'llmwiki', 'case-management'].includes(flow.target)))
})

test('observed model storage distinguishes a logical database, the shared instance and the independent application volume', () => {
  for (const [id, source, target] of [
    ['model-postgres', 'mem-gateway', 'mem-postgres'],
    ['model-db-instance', 'mem-postgres', 'sso-postgres'],
    ['postgres-volume', 'sso-postgres', 'local-storage'],
    ['model-files', 'mem-gateway', 'mem-files'],
    ['model-files-volume', 'mem-files', 'local-storage'],
  ]) {
    const flow = technicalFlows.find(value => value.id === id)!
    assert.equal(flow.source, source)
    assert.equal(flow.target, target)
    assert.equal(flow.evidence, 'observed')
  }
  assert.match(technicalFlows.find(flow => flow.id === 'postgres-volume')!.label, /postgres-data · 20Gi/)
  assert.match(technicalFlows.find(flow => flow.id === 'model-files-volume')!.label, /mem-ai-data · 1Gi/)
  assert.match(technicalFacts.find(fact => fact.id === 'sso-postgres')!.detail, /不同逻辑库和数据库用户名/)
  assert.match(technicalFacts.find(fact => fact.id === 'mem-files')!.detail, /不是当前 PostgreSQL 主数据目录/)
  assert.match(technicalFacts.find(fact => fact.id === 'local-storage')!.detail, /不是跨节点复制/)
  assert.ok(!technicalFlows.some(flow => flow.source === 'mem-postgres' && flow.target === 'local-storage'))
})

test('infrastructure is observed ready without claiming certificate issuance or a complete monitoring stack', () => {
  for (const id of ['cert-manager', 'coredns', 'metrics', 'calico']) {
    const fact = technicalFacts.find(value => value.id === id)!
    assert.equal(fact.runtime, 'ready')
    assert.match(fact.observation, /1\/1|2\/2/)
  }
  assert.match(technicalFacts.find(fact => fact.id === 'cert-manager')!.observation, /Certificate 资源为 0/)
  assert.match(technicalFacts.find(fact => fact.id === 'metrics')!.observation, /Available=True/)
  assert.match(technicalFacts.find(fact => fact.id === 'metrics')!.detail, /不能据此认定已有 Prometheus/)
})

test('the full technical topology lays out every component and routes every edge', async () => {
  const sizes = Object.fromEntries(technicalFacts.map(fact => [fact.id, { width: 270, height: 142 }]))
  const layout = await layoutGraph(technicalFacts, technicalFlows, sizes, technicalDomains)
  assert.equal(Object.keys(layout.positions).length, technicalFacts.length)
  assert.equal(Object.keys(layout.routes).length, technicalFlows.length)
  for (const fact of technicalFacts) {
    assert.ok(Number.isFinite(layout.positions[fact.id].x) && Number.isFinite(layout.positions[fact.id].y))
  }
  for (const domain of technicalDomains) {
    const bounds = layout.groups[domain.id]
    assert.ok(bounds, domain.id)
    for (const id of domain.members) {
      const point = layout.positions[id]
      assert.ok(point.x >= bounds.x + 30 && point.y >= bounds.y + 70, id)
      assert.ok(point.x + sizes[id].width <= bounds.x + bounds.width && point.y + sizes[id].height <= bounds.y + bounds.height, id)
    }
  }
  const main = layout.groups['main-server']
  const gpu = layout.groups['gpu-server']
  assert.ok(main.x + main.width <= gpu.x || gpu.x + gpu.width <= main.x || main.y + main.height <= gpu.y || gpu.y + gpu.height <= main.y)
  for (const flow of technicalFlows) {
    const route = layout.routes[flow.id]
    const source = layout.positions[flow.source]
    const target = layout.positions[flow.target]
    assert.ok(Math.abs(route[0].x - source.x - 270) < 1 && Math.abs(route[0].y - source.y - 71) < 1, flow.id)
    assert.ok(Math.abs(route.at(-1)!.x - target.x) < 1 && Math.abs(route.at(-1)!.y - target.y - 71) < 1, flow.id)
  }
})

test('GPU domains and browser layers are plans, not fabricated runtime evidence', () => {
  for (const id of deploymentFactIds) {
    const fact = technicalFacts.find(value => value.id === id)!
    assert.ok(fact, id)
    if (fact.runtime === 'ready') continue
    assert.equal(fact.runtime, 'planned', id)
    assert.equal(fact.state, 'planned', id)
    assert.ok(fact.sources.some(source => source.label.includes('2026-11-04')), id)
  }
  const main = technicalDomains.find(domain => domain.id === 'main-server')!
  const gpu = technicalDomains.find(domain => domain.id === 'gpu-server')!
  assert.ok(main.members.includes('kubernetes') && main.members.includes('ssh-tunnel'))
  assert.ok(!gpu.members.includes('kubernetes'))
  for (const id of ['client-integration', 'pwa-shell', 'browser-indexeddb', 'browser-cache']) {
    assert.ok(!main.members.includes(id) && !gpu.members.includes(id), id)
  }
  for (const [source, target] of [
    ['homepage', 'client-integration'], ['client-integration', 'pwa-shell'],
    ['client-integration', 'browser-indexeddb'], ['pwa-shell', 'browser-cache'],
    ['gpu-compute', 'ssh-tunnel'], ['apisix', 'gpu-api'], ['gpu-api', 'ssh-tunnel'],
    ...['gpu-tts', 'gpu-video', 'gpu-modeling'].map(id => ['ssh-tunnel', id]),
  ]) {
    assert.equal(technicalFlows.find(flow => flow.source === source && flow.target === target)!.evidence, 'planned')
  }
  assert.match(technicalFacts.find(fact => fact.id === 'ssh-tunnel')!.detail, /GPU → 主服务器/)
  assert.match(technicalFacts.find(fact => fact.id === 'gpu-api')!.detail, /localhost/)
  assert.match(technicalFacts.find(fact => fact.id === 'browser-indexeddb')!.detail, /不是服务端数据库/)
})
