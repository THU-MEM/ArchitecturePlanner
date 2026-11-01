import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePlan, updateModule, assignOwners, assignComponentOwners, addRelationship, addPerson } from '../src/plan.ts'

const fixture = () => ({
  schemaVersion: 1,
  name: 'Test plan',
  people: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }],
  modules: [
    { id: 'M01', name: 'Input', summary: 'Input module', detail: '', layer: 'learning', components: ['api'], owners: [], status: 'planned', position: { x: 0, y: 0 } },
    { id: 'M02', name: 'Assessment', summary: '', detail: '', layer: 'learning', components: [], owners: [], status: 'planned', position: { x: 400, y: 0 } },
  ],
  components: [{ id: 'api', name: 'API', detail: 'Application boundary', stack: '' }],
  relationships: [],
})

test('validates a complete plan and preserves round-trip fields', () => {
  const input = fixture()
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(input))), input)
})

test('rejects unknown people, invalid component references and duplicate module IDs', () => {
  const owners = fixture()
  assert.throws(() => validatePlan({
    ...owners,
    modules: [{ ...owners.modules[0], owners: [{ personId: 'unknown', role: 'primary' }] }, owners.modules[1]],
  }), /owner/i)
  const components = fixture()
  components.modules[0].components = ['unknown']
  assert.throws(() => validatePlan(components), /component/i)
  const duplicate = fixture()
  duplicate.modules.push(duplicate.modules[0])
  assert.throws(() => validatePlan(duplicate), /duplicate/i)
})

test('rejects multiple primary owners, primary-secondary duplication and malformed positions', () => {
  const plan = validatePlan(fixture())
  assert.throws(() => validatePlan({
    ...plan,
    modules: [{ ...plan.modules[0], owners: [{ personId: 'alice', role: 'primary' }, { personId: 'bob', role: 'primary' }] }, plan.modules[1]],
  }), /primary/i)
  assert.throws(() => assignOwners(plan, 'M01', 'alice', ['alice']), /duplicate/i)
  assert.throws(() => validatePlan({ ...plan, modules: [{ ...plan.modules[0], position: { x: Infinity, y: 0 } }, plan.modules[1]] }), /position/i)
})

test('owner changes preserve other modules and never mutate the original plan', () => {
  const plan = validatePlan(fixture())
  const assigned = assignOwners(plan, 'M01', 'alice', ['bob'])
  assert.deepEqual(assigned.modules[0].owners, [{ personId: 'alice', role: 'primary' }, { personId: 'bob', role: 'secondary' }])
  assert.deepEqual(plan.modules[0].owners, [])
  assert.equal(assigned.modules[1].name, 'Assessment')
  assert.deepEqual(assignOwners(assigned, 'M01', '', []).modules[0].owners, [])
})

test('technology component ownership is validated, independent of module ownership and immutable', () => {
  const plan = validatePlan(fixture())
  const assigned = assignComponentOwners(plan, 'api', 'alice', ['bob'])
  assert.deepEqual(assigned.components[0].owners, [{ personId: 'alice', role: 'primary' }, { personId: 'bob', role: 'secondary' }])
  assert.deepEqual(assigned.modules[0].owners, [])
  assert.ok(!plan.components[0].owners?.length)
  assert.throws(() => assignComponentOwners(plan, 'api', 'missing', []), /owner/i)
  assert.throws(() => assignComponentOwners(plan, 'api', 'alice', ['alice']), /duplicate/i)
  assert.throws(() => assignComponentOwners(plan, 'missing', 'alice', []), /component/i)
  assert.deepEqual(assignComponentOwners(assigned, 'api', '', []).components[0].owners, [])
})

test('module edits retain identity and reject missing modules, empty names and invalid status', () => {
  const plan = validatePlan(fixture())
  assert.equal(updateModule(plan, 'M01', { name: 'Renamed' }).modules[0].name, 'Renamed')
  assert.throws(() => updateModule(plan, 'missing', { name: 'X' }), /module/i)
  assert.throws(() => updateModule(plan, 'M01', { name: '' }), /name/i)
  assert.throws(() => validatePlan({ ...plan, modules: [{ ...plan.modules[0], status: 'invalid' }, plan.modules[1]] }), /status/i)
})

test('relationships require valid endpoints and do not duplicate an existing connection', () => {
  const plan = validatePlan(fixture())
  const connected = addRelationship(plan, 'M01', 'M02')
  assert.equal(connected.relationships.length, 1)
  assert.equal(addRelationship(connected, 'M01', 'M02').relationships.length, 1)
  assert.throws(() => addRelationship(plan, 'M01', 'missing'), /relationship/i)
  assert.throws(() => addRelationship(plan, 'M01', 'M01'), /relationship/i)
})

test('new people have stable distinct identities and duplicate display names are rejected', () => {
  const plan = validatePlan(fixture())
  const added = addPerson(plan, 'Carol')
  assert.equal(added.people.at(-1)?.name, 'Carol')
  assert.equal(new Set(added.people.map(person => person.id)).size, 3)
  assert.throws(() => addPerson(plan, 'Alice'), /already/i)
  assert.throws(() => addPerson(plan, ' '), /name/i)
})

test('rejects excess properties and oversized documents instead of silently discarding them', () => {
  assert.throws(() => validatePlan({ ...fixture(), token: 'do-not-import' }), /unexpected/i)
  assert.throws(() => validatePlan({ ...fixture(), name: 'x'.repeat(121) }), /name/i)
})
