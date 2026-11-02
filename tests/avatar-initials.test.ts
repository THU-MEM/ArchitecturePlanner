import test from 'node:test'
import assert from 'node:assert/strict'
import { createAvatar } from '@dicebear/core'
import * as initials from '@dicebear/initials'
import { avatarInitialsByLogin, avatarSeed } from '../src/avatar-initials.ts'
import published from '../src/seed-plan.json' with { type: 'json' }

test('all published participants have distinct authorized initials and render them without exposing source names', () => {
  const labels = Object.values(avatarInitialsByLogin)
  assert.equal(new Set(labels).size, labels.length)
  for (const person of published.people) {
    const label = avatarInitialsByLogin[person.name.toLowerCase()]
    assert.match(label, /^[A-Z]{2}$/)
    const svg = createAvatar(initials, { seed: avatarSeed(person.name) }).toString()
    assert.match(svg, new RegExp(`>${label}</text>`))
    assert.equal(avatarSeed(person.name), avatarSeed(person.name.toUpperCase()))
  }
  assert.equal(avatarSeed('HydraXman'), 'B S')
})

test('unmapped names retain the existing avatar fallback without inferring an identity', () => {
  for (const name of ['example-owner', 'Alice', 'constructor', '__proto__']) {
    assert.equal(avatarSeed(name), name)
  }
})
