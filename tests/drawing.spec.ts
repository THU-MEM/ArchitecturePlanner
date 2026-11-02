import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { drawingStorageKey } from '../src/drawing-assets.ts'
import seed from './fixture.ts'

type SceneElement = {
  id: string; type: string; x: number; y: number; width: number; height: number
  fileId?: string; text?: string; points?: number[][]
  startBinding?: { elementId: string }; endBinding?: { elementId: string }
  customData?: { logo: string }
}
type Scene = { elements: SceneElement[]; files: Record<string, { dataURL: string; mimeType: string }> }
const scene = (page: Page): Promise<Scene> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), drawingStorageKey)

async function openDrawing(page: Page) {
  await page.getByRole('navigation', { name: '规划视图' }).getByRole('button', { name: '架构画布', exact: true }).click()
  await expect(page.getByTestId('toolbar-rectangle')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: '下载画布文件', exact: true })).toBeEnabled()
}

async function draw(page: Page, tool: string, from: [number, number], to: [number, number]) {
  await page.getByTestId(`toolbar-${tool}`).click()
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 10 })
  await page.mouse.up()
}

async function downloadBytes(page: Page, button: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: button, exact: true }).click()
  const download = await pending
  const stream = (await download.createReadStream())!
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return { bytes: Buffer.concat(chunks), filename: download.suggestedFilename() }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
})

test('drawing tools create movable rectangles, connected arrows, lines, freehand strokes and text without modifying the plan', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (['font', 'image'].includes(request.resourceType()) && /^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4173') external.push(request.url())
  })
  await page.goto('./')
  await openDrawing(page)
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeDisabled()
  await draw(page, 'rectangle', [340, 200], [520, 340])
  await draw(page, 'rectangle', [740, 200], [920, 340])
  await draw(page, 'arrow', [525, 270], [735, 270])
  await draw(page, 'line', [340, 410], [580, 440])
  await page.getByTestId('toolbar-freedraw').click()
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await page.mouse.move(box.x + 740, box.y + 430)
  await page.mouse.down()
  for (const [x, y] of [[760, 410], [790, 460], [830, 420], [870, 440]]) await page.mouse.move(box.x + x, box.y + y, { steps: 4 })
  await page.mouse.up()
  await page.getByTestId('toolbar-text').click()
  await page.mouse.click(box.x + 360, box.y + 530)
  await page.locator('.excalidraw-wysiwyg').fill('模型网关 → PostgreSQL')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await scene(page)).elements.map(element => element.type).sort()).toEqual(['arrow', 'freedraw', 'line', 'rectangle', 'rectangle', 'text'].sort())
  const before = await scene(page)
  const arrow = before.elements.find(element => element.type === 'arrow')!
  expect(arrow.startBinding?.elementId).toBe(before.elements.filter(element => element.type === 'rectangle')[0].id)
  expect(arrow.endBinding?.elementId).toBe(before.elements.filter(element => element.type === 'rectangle')[1].id)
  expect(before.elements.find(element => element.type === 'freedraw')!.points!.length).toBeGreaterThan(4)
  expect(before.elements.find(element => element.type === 'text')!.text).toBe('模型网关 → PostgreSQL')
  await page.getByTestId('toolbar-selection').click()
  await page.mouse.move(box.x + 430, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 460, box.y + 170, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await scene(page)).elements.find(element => element.id === before.elements[0].id)!.x).not.toBe(before.elements[0].x)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-desktop.png', animations: 'disabled' })
  await page.getByRole('button', { name: '业务架构', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue(seed.modules[0].name)
  await openDrawing(page)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(6)
  await page.reload()
  await openDrawing(page)
  await expect(page.locator('.drawing-save-status')).toContainText('6 个元素')
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('local SVG logos insert, drag, undo, persist and export as a nonempty PNG with matching image files', async ({ page }) => {
  await page.goto('./')
  await openDrawing(page)
  await page.getByRole('button', { name: '插入 PostgreSQL Logo', exact: true }).click()
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  const first = (await scene(page)).elements[0]
  expect(first.type).toBe('image')
  expect(first.customData?.logo).toBe('PostgreSQL')
  const file = (await scene(page)).files[first.fileId!]
  expect(file.mimeType).toBe('image/svg+xml')
  expect(file.dataURL).toMatch(/^data:image\/svg\+xml/)
  await page.locator('.drawing-stage .excalidraw').focus()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.drawing-save-status')).toContainText('0 个元素')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  const transfer = await page.evaluateHandle(() => new DataTransfer())
  const logo = page.getByRole('button', { name: '插入 React Logo', exact: true })
  await logo.dispatchEvent('dragstart', { dataTransfer: transfer })
  const target = page.locator('.drawing-stage canvas.interactive')
  const box = (await target.boundingBox())!
  await target.dispatchEvent('dragover', { dataTransfer: transfer })
  await target.dispatchEvent('drop', { dataTransfer: transfer, clientX: box.x + 360, clientY: box.y + 300 })
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  const second = (await scene(page)).elements.find(element => element.customData?.logo === 'React')!
  expect(second.x).not.toBe(first.x)
  await page.reload()
  await openDrawing(page)
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  const editable = await downloadBytes(page, '下载画布文件')
  expect(editable.filename).toBe('architecture-canvas.excalidraw')
  const exported = JSON.parse(editable.bytes.toString('utf8'))
  expect(exported.elements).toHaveLength(2)
  expect(Object.keys(exported.files)).toHaveLength(2)
  const png = await downloadBytes(page, '导出 PNG')
  expect(png.filename).toBe('architecture-canvas.png')
  expect([...png.bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.bytes.readUInt32BE(16)).toBeGreaterThan(80)
  expect(png.bytes.readUInt32BE(20)).toBeGreaterThan(80)
  expect(Math.max(png.bytes.readUInt32BE(16), png.bytes.readUInt32BE(20))).toBeLessThanOrEqual(4096)
  const coloredPixels = await page.evaluate(async data => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let colored = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] && Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 50) colored++
    }
    return colored
  }, png.bytes.toString('base64'))
  expect(coloredPixels).toBeGreaterThan(100)
  await page.locator('input[aria-label="导入架构画布文件"]').setInputFiles({ name: editable.filename, mimeType: 'application/json', buffer: editable.bytes })
  await expect(page.getByRole('region', { name: '替换架构画布' })).toBeVisible()
  await page.getByRole('button', { name: '保留当前画布', exact: true }).click()
  await page.locator('input[aria-label="导入架构画布文件"]').setInputFiles({ name: editable.filename, mimeType: 'application/json', buffer: editable.bytes })
  await page.getByRole('button', { name: '确认替换画布', exact: true }).click()
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  expect((await scene(page)).elements.map(element => element.customData?.logo).sort()).toEqual(['PostgreSQL', 'React'])
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('mobile canvas fills the viewport, searches and inserts logos while keeping navigation and PNG export reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await openDrawing(page)
  const stage = page.locator('.drawing-stage')
  expect(await stage.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
  expect((await stage.boundingBox())!.height).toBeGreaterThan(500)
  await page.getByRole('button', { name: '技术 Logo', exact: true }).click()
  await page.getByLabel('搜索 Logo', { exact: true }).fill('kubernetes')
  await expect(page.locator('.drawing-logo-grid button')).toHaveCount(1)
  await page.getByRole('button', { name: '插入 Kubernetes Logo', exact: true }).click()
  await expect(page.getByRole('complementary', { name: '技术 Logo 素材' })).toHaveCount(0)
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await stage.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
})

test('invalid imports and failed logo reads report errors without replacing the current drawing', async ({ page }) => {
  await page.goto('./')
  await openDrawing(page)
  await page.getByRole('button', { name: '插入 React Logo', exact: true }).click()
  const original = (await scene(page)).elements
  await page.locator('input[aria-label="导入架构画布文件"]').setInputFiles({ name: 'invalid.excalidraw', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1}') })
  await expect(page.getByRole('alert')).toContainText('现有内容未修改')
  expect((await scene(page)).elements).toEqual(original)
  await page.route('**/icons/logos-postgresql.svg', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.getByRole('button', { name: '插入 PostgreSQL Logo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('503')
  expect((await scene(page)).elements).toEqual(original)
})

test('autosave failure preserves editable content and offers an independent downloadable backup', async ({ page }) => {
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError')
      return original.call(this, name, value)
    }
  }, drawingStorageKey)
  await page.goto('./')
  await openDrawing(page)
  await page.getByRole('button', { name: '插入 React Logo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('画布自动保存失败')
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  const backup = await downloadBytes(page, '下载画布文件')
  expect(JSON.parse(backup.bytes.toString('utf8')).elements).toHaveLength(1)
  const png = await downloadBytes(page, '导出 PNG')
  expect(png.bytes.readUInt32BE(16)).toBeGreaterThan(0)
})

test('an unreadable drawing is not silently overwritten and can be backed up before explicit discard', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(key => { localStorage.setItem(key, '{invalid'); localStorage.setItem('unrelated', 'keep') }, drawingStorageKey)
  await page.getByRole('button', { name: '架构画布', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('原草稿未覆盖')
  expect(await page.evaluate(key => localStorage.getItem(key), drawingStorageKey)).toBe('{invalid')
  const backup = await downloadBytes(page, '下载原始草稿备份')
  expect(backup.bytes.toString('utf8')).toBe('{invalid')
  await page.getByRole('button', { name: '舍弃此画布草稿并新建', exact: true }).click()
  await expect(page.getByTestId('toolbar-rectangle')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep')
})
