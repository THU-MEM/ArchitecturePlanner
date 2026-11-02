import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePlan } from '../src/plan.ts'

test('the repository planning document is publishable, including its owner references', () => {
  const document = JSON.parse(readFileSync(new URL('../src/seed-plan.json', import.meta.url), 'utf8'))
  assert.doesNotThrow(() => validatePlan(document))
})
