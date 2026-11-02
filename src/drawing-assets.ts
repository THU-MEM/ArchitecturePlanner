import catalog from './icon-catalog.json' with { type: 'json' }
import type { IconReference } from './icons.ts'

export const drawingStorageKey = 'architecture-planner.drawing.v1'
export const drawingLogos: IconReference[] = Object.values(catalog.icons)
  .filter(icon => icon.brand)
  .sort((a, b) => a.label.localeCompare(b.label))
