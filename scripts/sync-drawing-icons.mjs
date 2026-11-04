import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const library = JSON.parse(await readFile(join(root, 'src', 'drawing-icon-library.json'), 'utf8'))
const catalog = JSON.parse(await readFile(join(root, 'src', 'icon-catalog.json'), 'utf8'))
const destination = join(root, 'public', 'icons', 'drawing')
await mkdir(destination, { recursive: true })
const existing = new Set(Object.values(catalog.icons).filter(icon => icon.brand).map(icon => icon.label))
const source = library.sources.logos
const tree = JSON.parse(execFileSync('gh', ['api', `repos/${source.repository}/git/trees/${source.revision}?recursive=1`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }))
const paths = new Set(tree.tree.map(item => item.path))
const logos = Object.values(library.logoGroups).flat().filter(([, label]) => !existing.has(label))
const missing = logos.filter(([slug]) => !paths.has(`logos/${slug}.svg`)).map(([slug]) => slug)
if (missing.length) throw new Error(`Unknown upstream logos: ${missing.join(', ')}`)

const checksums = {}
async function save(name, bytes) {
  const svg = bytes.toString('utf8').replaceAll('\r\n', '\n')
  if (!/<svg\b/.test(svg) || !/\bviewBox=/.test(svg) || /<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|url)\s*[(=]\s*["']?https?:/i.test(svg)) {
    throw new Error(`Invalid or non-self-contained SVG: ${name}`)
  }
  await writeFile(join(destination, name), svg)
  checksums[name] = createHash('sha256').update(svg).digest('hex')
}

for (let offset = 0; offset < logos.length; offset += 6) {
  await Promise.all(logos.slice(offset, offset + 6).map(async ([slug]) => {
    const bytes = execFileSync('gh', ['api', `repos/${source.repository}/contents/logos/${slug}.svg?ref=${source.revision}`, '-H', 'Accept: application/vnd.github.raw+json'], { maxBuffer: 2 * 1024 * 1024 })
    await save(`logo-${slug}.svg`, bytes)
  }))
}

const simple = library.sources.simpleIcons
const alibaba = execFileSync('gh', ['api', `repos/${simple.repository}/contents/icons/alibabacloud.svg?ref=${simple.revision}`, '-H', 'Accept: application/vnd.github.raw+json'])
await save('alibabacloud.svg', Buffer.from(alibaba.toString('utf8').replace('<svg ', '<svg fill="#FF6A00" ')))

for (const [code, , glyph] of library.alibabaServices) {
  const svg = await readFile(join(root, 'public', 'icons', `lucide-${glyph}.svg`), 'utf8')
  const illustration = svg.replace(/<svg\b[^>]*>/, opening => opening
    .replace(/\s(?:x|y|width|height)="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .replace('<svg', '<svg x="24" y="4" width="48" height="48"'))
    .replaceAll('#285a72', '#a54800')
  const fontSize = code.length > 10 ? 10 : code.length > 7 ? 12 : 15
  await save(`aliyun-${code.toLowerCase()}.svg`, Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="88" viewBox="0 0 96 88"><title>Service illustration: ${code}; not an official Alibaba Cloud product icon</title>${illustration}<text x="48" y="77" text-anchor="middle" fill="#a54800" font-family="Arial,sans-serif" font-weight="600" font-size="${fontSize}">${code}</text></svg>\n`,
  ))
}

await writeFile(join(root, 'src', 'drawing-icon-checksums.json'), `${JSON.stringify(checksums, null, 2)}\n`)
console.log(`Imported ${logos.length + 1} brand logos and ${library.alibabaServices.length} transparent service illustrations; existing brand assets retained.`)
