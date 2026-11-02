import catalog from './icon-catalog.json' with { type: 'json' }
import seed from './seed-plan.json' with { type: 'json' }
import type { Component } from './plan.ts'

export type IconReference = { src: string; label: string; brand: boolean }
const icons: Record<string, IconReference> = catalog.icons
const nodes: Record<string, string> = catalog.nodeIcons
const brands: Record<string, string[]> = catalog.componentBrands
const actions: Record<string, string> = {
  download: 'lucide:download', upload: 'lucide:upload', users: 'lucide:users',
  search: 'lucide:search', plus: 'lucide:plus', x: 'lucide:x', check: 'lucide:check',
  github: 'logos:github-icon', cloudflare: 'logos:cloudflare', azure: 'logos:microsoft-azure',
  canvas: 'lucide:workflow', list: 'lucide:clipboard-check', technology: 'lucide:cpu',
  original: 'lucide:book-open', layer: 'lucide:layers', person: 'lucide:contact-round',
  help: 'lucide:book-open', lock: 'lucide:lock-keyhole', submit: 'lucide:send',
}
const brandPatterns: [RegExp, string][] = [
  [/\bAzure\b/i, 'logos:microsoft-azure'], [/\bCloudflare\b/i, 'logos:cloudflare'],
  [/\bReact\b/i, 'logos:react'], [/\bGrafana\b/i, 'logos:grafana'],
  [/\bPrometheus\b/i, 'logos:prometheus'], [/\bPostgreSQL\b/i, 'logos:postgresql'],
  [/\bRedis\b/i, 'logos:redis'], [/\bDocker\b/i, 'logos:docker-icon'],
  [/\bKubernetes\b/i, 'logos:kubernetes'], [/\bOpenTelemetry\b/i, 'logos:opentelemetry-icon'],
]

function lookup(key: string): IconReference {
  const icon = icons[key]
  if (!icon) throw new Error(`Unknown icon: ${key}`)
  return icon
}

export function componentIcons(component: Component): IconReference[] {
  const baseline = seed.components.find(item => item.id === component.id)
  const original = baseline?.name === component.name && baseline.detail === component.detail && baseline.stack === component.stack
  const selected = new Set<string>()
  if (original) {
    for (const key of brands[component.id] ?? []) selected.add(key)
    const key = nodes[component.id]
    if (key && lookup(key).brand) selected.add(key)
  }
  for (const [pattern, key] of brandPatterns) if (pattern.test(`${component.name} ${component.stack}`)) selected.add(key)
  if (selected.size) return [...selected].map(lookup)
  const generic = nodes[component.id]
  return [lookup(generic && !lookup(generic).brand ? generic : 'lucide:boxes')]
}

export function moduleIcon(id: string): IconReference {
  return lookup(nodes[id] ?? 'lucide:boxes')
}

export function uiIcon(id: string): IconReference {
  const key = actions[id]
  if (!key) throw new Error(`Unknown action icon: ${id}`)
  return lookup(key)
}
