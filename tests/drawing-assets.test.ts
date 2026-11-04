import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { drawingCategories, drawingLogos, drawingStorageKey, filterDrawingLogos } from '../src/drawing-assets.ts'
import catalog from '../src/icon-catalog.json' with { type: 'json' }
import library from '../src/drawing-icon-library.json' with { type: 'json' }
import checksums from '../src/drawing-icon-checksums.json' with { type: 'json' }

test('drawing library has 100+ distinct brand SVGs and 60+ explicitly identified Alibaba service illustrations', () => {
  assert.notEqual(drawingStorageKey, 'architecture-planner.plan.v1')
  assert.ok(drawingLogos.filter(icon => icon.kind === 'brand').length > 100)
  assert.ok(drawingLogos.filter(icon => icon.kind === 'service' && icon.category === 'alibaba').length >= 60)
  assert.equal(new Set(drawingLogos.map(icon => icon.src)).size, drawingLogos.length)
  assert.equal(new Set(drawingLogos.map(icon => icon.label)).size, drawingLogos.length)
  const hashes = new Set<string>()
  for (const icon of drawingLogos) {
    assert.equal(icon.brand, true)
    assert.ok(drawingCategories[icon.category], icon.label)
    assert.ok(icon.keywords, icon.label)
    assert.match(icon.src, /^icons\/(?:drawing\/)?[^/]+\.svg$/)
    const bytes = readFileSync(join('public', icon.src))
    const hash = createHash('sha256').update(bytes).digest('hex')
    hashes.add(hash)
    const svg = bytes.toString('utf8')
    assert.match(svg, /<svg\b/)
    assert.match(svg, /\bviewBox=/)
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|url)\s*[(=]\s*["']?https?:/i)
    if (icon.src.startsWith('icons/drawing/')) {
      assert.equal(hash, checksums[icon.src.slice('icons/drawing/'.length)], icon.src)
    }
    if (icon.kind === 'service') {
      assert.match(svg, /not an official Alibaba Cloud product icon/)
      assert.doesNotMatch(svg, /<rect\b|<image\b/)
    }
  }
  assert.equal(hashes.size, drawingLogos.length, 'Do not inflate the catalog with duplicate SVG files')
  for (const icon of Object.values(catalog.icons).filter(icon => icon.brand)) {
    assert.ok(drawingLogos.some(item => item.label === icon.label && item.src === icon.src), icon.label)
  }
  assert.equal(Object.keys(checksums).length, drawingLogos.filter(icon => icon.src.startsWith('icons/drawing/')).length)
  for (const source of Object.values(library.sources)) {
    assert.match(source.revision, /^[a-f0-9]{40}$/)
    assert.equal(source.license, 'CC0-1.0')
  }
})

test('drawing search supports Chinese names, product acronyms, aliases, category filters and multiple terms', () => {
  assert.equal(filterDrawingLogos('   ').length, drawingLogos.length)
  assert.ok(filterDrawingLogos('对象存储').some(icon => icon.label.includes('OSS')))
  assert.deepEqual(filterDrawingLogos('ALIYUN 对象存储').map(icon => icon.label), ['阿里云 OSS · 对象存储'])
  assert.ok(filterDrawingLogos('千问').some(icon => icon.label === 'Qwen'))
  assert.ok(filterDrawingLogos('Postgres', 'data').some(icon => icon.label === 'PostgreSQL'))
  assert.equal(filterDrawingLogos('Postgres', 'security').length, 0)
  assert.ok(filterDrawingLogos('', 'alibaba').length >= 60)
  assert.ok(filterDrawingLogos('nonexistent-icon').length === 0)
})
