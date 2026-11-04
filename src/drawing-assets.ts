import catalog from './icon-catalog.json' with { type: 'json' }
import library from './drawing-icon-library.json' with { type: 'json' }
import type { IconReference } from './icons.ts'

export const drawingStorageKey = 'architecture-planner.drawing.v1'
export const drawingCategories: Record<string, string> = {
  alibaba: '阿里云与生态',
  cloud: '云平台与服务',
  containers: '容器与基础设施',
  data: '数据库与消息',
  observability: '监控与可观测',
  development: '开发与交付',
  ai: 'AI 与数据科学',
  security: '安全与身份',
}
export type DrawingIcon = IconReference & {
  category: string
  keywords: string
  kind: 'brand' | 'service'
}

export const drawingLogos: DrawingIcon[] = [
  ...Object.entries(library.logoGroups).flatMap(([category, entries]) => entries.map(([slug, label, keywords]): DrawingIcon => ({
    src: Object.values(catalog.icons).find(icon => icon.brand && icon.label === label)?.src ?? `icons/drawing/logo-${slug}.svg`,
    label, brand: true, category, keywords, kind: 'brand',
  }))),
  {
    src: 'icons/drawing/alibabacloud.svg', label: 'Alibaba Cloud', brand: true,
    category: 'alibaba', keywords: '阿里云 Aliyun 阿里 云计算', kind: 'brand',
  } satisfies DrawingIcon,
  ...library.alibabaServices.map(([code, name, , keywords]): DrawingIcon => ({
    src: `icons/drawing/aliyun-${code.toLowerCase()}.svg`,
    label: `阿里云 ${code} · ${name}`, brand: true, category: 'alibaba',
    keywords: `Alibaba Cloud Aliyun ${keywords}`, kind: 'service',
  })),
].sort((a, b) => a.label.localeCompare(b.label, 'en'))

export function filterDrawingLogos(search: string, category = ''): DrawingIcon[] {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return drawingLogos.filter(icon => (!category || icon.category === category) && words.every(word =>
    `${icon.label} ${icon.keywords} ${drawingCategories[icon.category]}`.toLocaleLowerCase().includes(word)))
}
