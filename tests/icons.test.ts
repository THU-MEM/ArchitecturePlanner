import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import seed from '../src/seed-plan.json' with { type: 'json' }
import { componentIcons, moduleIcon, uiIcon } from '../src/icons.ts'

test('original observability components expose their actual full-color technology logos', () => {
  const component = seed.components.find(component => component.id === 'observability')!
  const icons = componentIcons(component)
  assert.ok(icons.some(icon => icon.label === 'Grafana' && icon.brand))
  assert.ok(icons.some(icon => icon.label === 'Prometheus' && icon.brand))
})

test('Azure branding follows the supplied technology instead of inventing an Azure dependency', () => {
  const azure = { id: 'custom-service', name: 'AI gateway', detail: '', stack: 'Microsoft Azure' }
  assert.ok(componentIcons(azure).some(icon => icon.label === 'Azure'))
  assert.ok(!componentIcons({ ...azure, stack: 'Custom REST API' }).some(icon => icon.label === 'Azure'))
})

test('every displayed icon is a local standalone SVG with no executable or remote content', () => {
  const icons = [
    ...seed.modules.map(module => moduleIcon(module.id)),
    ...seed.components.flatMap(componentIcons),
    ...['download', 'upload', 'users', 'search', 'plus', 'github', 'cloudflare', 'azure'].map(uiIcon),
  ]
  for (const icon of icons) {
    assert.match(icon.src, /^icons\/[a-z0-9-]+\.svg$/)
    const svg = readFileSync(new URL(`../public/${icon.src}`, import.meta.url), 'utf8')
    assert.match(svg, /<svg\b/)
    assert.doesNotMatch(svg, /<script|<foreignObject|\bon\w+\s*=|(?:href=["']|url\(["']?)https?:|@import/i)
  }
  const grafana = icons.find(icon => icon.label === 'Grafana')!
  assert.match(readFileSync(new URL(`../public/${grafana.src}`, import.meta.url), 'utf8'), /#[0-9a-f]{6}/i)
})
