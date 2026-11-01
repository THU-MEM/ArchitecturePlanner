import { test, expect } from '@playwright/test'
import seed from '../src/seed-plan.json' with { type: 'json' }
import { assignComponentOwners, validatePlan } from '../src/plan.ts'

const base = 'http://127.0.0.1:8787'
const headers = { Authorization: 'Bearer test-only-not-a-real-secret-1234567890', Origin: 'http://127.0.0.1:4173' }

test('D1 REST API enforces authentication, validation and optimistic write concurrency', async ({ request }) => {
  expect((await request.get(`${base}/api/plan`)).status()).toBe(401)
  expect((await request.get(`${base}/api/plan`, { headers: { ...headers, Origin: 'https://untrusted.example' } })).status()).toBe(403)
  const initial = await request.get(`${base}/api/plan`, { headers })
  expect(initial.status()).toBe(200)
  expect(initial.headers()['access-control-allow-origin']).toBe('http://127.0.0.1:4173')
  const snapshot = await initial.json()
  const plan = { ...seed, name: 'Shared test plan' }
  const saved = await request.put(`${base}/api/plan`, { headers, data: { revision: snapshot.revision, plan } })
  expect(saved.status()).toBe(200)
  expect((await saved.json()).revision).toBe(snapshot.revision + 1)
  const conflict = await request.put(`${base}/api/plan`, { headers, data: { revision: snapshot.revision, plan } })
  expect(conflict.status()).toBe(409)
  expect((await request.get(`${base}/api/plan`, { headers }).then(response => response.json())).plan.name).toBe('Shared test plan')
  expect((await request.put(`${base}/api/plan`, { headers, data: { revision: snapshot.revision + 1, plan: { ...plan, people: [{ id: 'P1', name: 'Alice' }], modules: [{ ...plan.modules[0], owners: [{ personId: 'missing', role: 'primary' }] }] } } })).status()).toBe(400)
  expect((await request.put(`${base}/api/plan`, { headers, data: { revision: snapshot.revision + 1, plan: { ...plan, name: 'x'.repeat(600000) } } })).status()).toBe(413)
  const preflight = await request.fetch(`${base}/api/plan`, { method: 'OPTIONS', headers: { Origin: headers.Origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' } })
  expect(preflight.status()).toBe(204)
})

test('the authenticated D1 API really persists technology component owner assignments', async ({ request }) => {
  const snapshot = await request.get(`${base}/api/plan`, { headers }).then(response => response.json())
  const plan = assignComponentOwners(validatePlan({
    ...seed, people: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }],
  }), 'postgres', 'alice', ['bob'])
  const saved = await request.put(`${base}/api/plan`, { headers, data: { plan, revision: snapshot.revision } })
  expect(saved.status()).toBe(200)
  const stored = await request.get(`${base}/api/plan`, { headers }).then(response => response.json())
  expect(stored.plan.components.find((component: { id: string }) => component.id === 'postgres').owners).toEqual([
    { personId: 'alice', role: 'primary' }, { personId: 'bob', role: 'secondary' },
  ])
})
