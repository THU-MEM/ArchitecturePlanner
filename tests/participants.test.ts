import test from 'node:test'
import assert from 'node:assert/strict'
import seed from './fixture.ts'
import { assignOwners, validatePlan } from '../src/plan.ts'
import { mergeGitHubParticipants } from '../src/participants.ts'

test('configured participants have stable GitHub IDs, are assignable and merge idempotently', () => {
  const plan = validatePlan(seed)
  const roster = [{ id: 101, login: 'example-owner' }, { id: 202, login: 'example-helper' }]
  const merged = mergeGitHubParticipants(plan, roster)
  assert.deepEqual(merged.people, [{ id: 'github-101', name: 'example-owner' }, { id: 'github-202', name: 'example-helper' }])
  assert.deepEqual(mergeGitHubParticipants(merged, roster), merged)
  assert.deepEqual(assignOwners(merged, 'M01', 'github-101', ['github-202']).modules.find(module => module.id === 'M01')!.owners, [
    { personId: 'github-101', role: 'primary' }, { personId: 'github-202', role: 'secondary' },
  ])
  assert.deepEqual(plan.people, [])
})

test('matching existing names keep their IDs and all assignments, even after a GitHub rename', () => {
  const plan = assignOwners(validatePlan({ ...seed, people: [{ id: 'local-owner', name: 'Example-Owner' }, { id: 'github-202', name: 'old-helper' }] }), 'M01', 'local-owner', ['github-202'])
  const merged = mergeGitHubParticipants(plan, [{ id: 101, login: 'example-owner' }, { id: 202, login: 'new-helper' }])
  assert.deepEqual(merged.people, [{ id: 'local-owner', name: 'Example-Owner' }, { id: 'github-202', name: 'new-helper' }])
  assert.deepEqual(merged.modules, plan.modules)
  assert.deepEqual(merged.components, plan.components)
  assert.deepEqual(mergeGitHubParticipants(merged, []).people, merged.people)
})

test('malformed, duplicated or conflicting participant configuration is rejected atomically', () => {
  const plan = validatePlan(seed)
  for (const roster of [
    {}, [{ id: -1, login: 'bad' }], [{ id: 1.5, login: 'bad' }], [{ id: 101, login: '<script>' }],
    [{ id: 101, login: 'a--b' }], [{ id: 101, login: 'valid', token: 'not-allowed' }],
    [{ id: 101, login: 'first' }, { id: 101, login: 'second' }],
    [{ id: 101, login: 'Same' }, { id: 202, login: 'same' }],
    Array.from({ length: 201 }, (_, index) => ({ id: index + 1, login: `user-${index}` })),
  ]) {
    assert.throws(() => mergeGitHubParticipants(plan, roster), /participant/i)
    assert.deepEqual(plan.people, [])
  }
  const conflicting = validatePlan({ ...seed, people: [{ id: 'github-101', name: 'old-name' }, { id: 'manual', name: 'new-name' }] })
  assert.throws(() => mergeGitHubParticipants(conflicting, [{ id: 101, login: 'new-name' }]), /conflict/i)
  const full = validatePlan({ ...seed, people: Array.from({ length: 200 }, (_, index) => ({ id: `p-${index}`, name: `Member ${index}` })) })
  assert.throws(() => mergeGitHubParticipants(full, [{ id: 101, login: 'another' }]), /people/i)
})
