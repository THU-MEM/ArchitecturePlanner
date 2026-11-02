import { readFileSync } from 'node:fs'
import { validatePlan } from '../src/plan.ts'
import type { Module } from '../src/plan.ts'

const html = readFileSync(new URL('../public/architecture.html', import.meta.url), 'utf8')
const embedded = html.match(/<script id="architecture-data" type="application\/json">([\s\S]*?)<\/script>/)
if (!embedded) throw new Error('Original architecture fixture is missing')
const original: {
  modules: Pick<Module, 'id' | 'name' | 'summary' | 'detail' | 'layer'>[]
  components: Record<string, { title: string; detail: string; stack?: string }>
  moduleTechnology: Record<string, string[]>
} = JSON.parse(embedded[1])
let y = 0
const modules = ['frontend', 'learning', 'knowledge', 'platform', 'governance'].flatMap(layer => {
  const group = original.modules.filter(module => module.layer === layer)
  const result = group.map((module, index) => ({
    id: module.id, name: module.name, summary: module.summary, detail: module.detail, layer,
    components: original.moduleTechnology[module.id], owners: [], status: 'planned',
    position: { x: index % 4 * 290, y: y + Math.floor(index / 4) * 170 },
  }))
  y += Math.ceil(group.length / 4) * 170 + 20
  return result
})

export default validatePlan({
  schemaVersion: 1, name: 'AI-MEM 架构分工规划', people: [], modules,
  components: Object.entries(original.components).map(([id, component]) => ({
    id, name: component.title, detail: component.detail, stack: component.stack ?? '',
  })),
  relationships: [],
})
