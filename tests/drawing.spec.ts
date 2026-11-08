import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { drawingCategories, drawingLogos, drawingStorageKey, filterDrawingLogos } from '../src/drawing-assets.ts'
import seed from './fixture.ts'

type SceneElement = {
  id: string; type: string; x: number; y: number; width: number; height: number
  fileId?: string; text?: string; points?: number[][]
  startBinding?: { elementId: string; fixedPoint?: number[] }; endBinding?: { elementId: string; fixedPoint?: number[] }
  boundElements?: { id: string; type: string }[]
  startArrowhead?: string | null; endArrowhead?: string | null; strokeStyle?: string; elbowed?: boolean
  customData?: { logo: string }
}
type Scene = { elements: SceneElement[]; files: Record<string, { dataURL: string; mimeType: string }> }
const scene = (page: Page): Promise<Scene> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), drawingStorageKey)

const coloredScenePixels = (page: Page) => page.locator<HTMLCanvasElement>('.drawing-stage canvas.static').evaluate(canvas => {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
  let colored = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] && Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 50) colored++
  }
  return colored
})

async function openDrawing(page: Page) {
  await page.getByRole('navigation', { name: '规划视图' }).getByRole('button', { name: '架构画布', exact: true }).click()
  await expect(page.getByTestId('toolbar-rectangle')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: '下载画布文件', exact: true })).toBeEnabled()
}

async function selectTool(page: Page, tool: string) {
  const input = page.getByTestId(`toolbar-${tool}`)
  await page.locator('label.ToolIcon').filter({ has: input }).click()
  await expect(input).toBeChecked()
}

async function draw(page: Page, tool: string, from: [number, number], to: [number, number]) {
  await selectTool(page, tool)
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

async function connectFromPort(page: Page, side: string, target: { x: number; y: number }) {
  const port = page.getByRole('button', { name: `从${side}侧锚点连线`, exact: true })
  const box = (await port.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 12 })
  await expect(page.locator('.drawing-connect-target')).toBeVisible()
  await page.mouse.up()
}

async function dropLogo(page: Page, name: string, x: number, y: number) {
  const transfer = await page.evaluateHandle(() => new DataTransfer())
  await page.getByRole('button', { name: `插入 ${name} Logo`, exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer })
  await page.locator('.drawing-stage canvas.interactive').dispatchEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y })
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
  await selectTool(page, 'freedraw')
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await page.mouse.move(box.x + 740, box.y + 430)
  await page.mouse.down()
  for (const [x, y] of [[760, 410], [790, 460], [830, 420], [870, 440]]) await page.mouse.move(box.x + x, box.y + y, { steps: 4 })
  await page.mouse.up()
  await selectTool(page, 'text')
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
  await selectTool(page, 'selection')
  await page.mouse.move(box.x + 430, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 460, box.y + 170, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await scene(page)).elements.find(element => element.id === before.elements[0].id)!.x).not.toBe(before.elements[0].x)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-desktop.png', animations: 'disabled' })
  await page.getByRole('button', { name: '业务架构', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue(seed.modules.find(module => module.id === 'M01')!.name)
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
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
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
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
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
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  expect((await scene(page)).elements.map(element => element.customData?.logo).sort()).toEqual(['PostgreSQL', 'React'])
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('visible brush draws continuous mouse trajectories and preserves native tool switching, undo and export', async ({ page }) => {
  await page.goto('./')
  await openDrawing(page)
  const brush = page.getByRole('button', { name: '画笔', exact: true })
  await brush.click()
  await expect(brush).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toolbar-freedraw')).toBeChecked()
  const box = (await page.locator('.drawing-stage').boundingBox())!
  for (const offset of [0, 80]) {
    await page.mouse.move(box.x + 340, box.y + 280 + offset)
    await page.mouse.down()
    for (const [x, y] of [[380, 250], [420, 310], [460, 260], [500, 300]]) {
      await page.mouse.move(box.x + x, box.y + y + offset, { steps: 6 })
    }
    await page.mouse.up()
  }
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  const strokes = (await scene(page)).elements
  for (const stroke of strokes) {
    expect(stroke.type).toBe('freedraw')
    expect(stroke.points!.length).toBeGreaterThan(12)
    expect(new Set(stroke.points!.map(point => point[1])).size).toBeGreaterThan(4)
  }
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  await page.getByRole('button', { name: '选择', exact: true }).click()
  await expect(brush).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('toolbar-selection')).toBeChecked()
  await selectTool(page, 'freedraw')
  await expect(brush).toHaveAttribute('aria-pressed', 'true')
  const backup = JSON.parse((await downloadBytes(page, '下载画布文件')).bytes.toString('utf8'))
  expect(backup.elements.map((element: SceneElement) => element.points)).toEqual(strokes.map(stroke => stroke.points))
  expect([...((await downloadBytes(page, '导出 PNG')).bytes.subarray(0, 8))]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-brush-desktop.png', animations: 'disabled' })
  await page.reload()
  await openDrawing(page)
  await expect.poll(async () => (await scene(page)).elements.map(element => element.points)).toEqual(strokes.map(stroke => stroke.points))
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('touchscreen brush records finger and pen trajectories instead of scrolling the page', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
    await page.goto('./')
    await openDrawing(page)
    await page.getByRole('button', { name: '技术 Logo', exact: true }).tap()
    await expect(page.getByRole('complementary', { name: '技术 Logo 素材' })).toBeVisible()
    await page.getByRole('button', { name: '画笔', exact: true }).tap()
    await expect(page.getByRole('complementary', { name: '技术 Logo 素材' })).toHaveCount(0)
    await expect(page.getByTestId('toolbar-freedraw')).toBeChecked()
    const box = (await page.locator('.drawing-stage').boundingBox())!
    const scroll = await page.evaluate(() => window.scrollY)
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 70, y: box.y + 260 }] })
    for (const [x, y] of [[90, 270], [120, 300], [150, 250], [180, 290], [210, 260], [240, 310]]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: box.y + y }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
    const stroke = (await scene(page)).elements[0]
    expect(stroke.type).toBe('freedraw')
    expect(stroke.points!.length).toBeGreaterThan(4)
    expect(new Set(stroke.points!.map(point => point[1])).size).toBeGreaterThan(3)
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll)
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 70, y: box.y + 390, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen', force: 0.5 })
    for (const [x, y] of [[100, 420], [140, 380], [180, 420], [230, 390]]) {
      await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: box.y + y, button: 'left', buttons: 1, pointerType: 'pen', force: 0.7 })
    }
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 230, y: box.y + 390, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' })
    await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
    expect((await scene(page)).elements[1].type).toBe('freedraw')
    expect((await scene(page)).elements[1].points!.length).toBeGreaterThan(3)
    await mkdir('.impeccable/review', { recursive: true })
    await page.screenshot({ path: '.impeccable/review/topology-drawing-brush-touch.png', animations: 'disabled' })
  } finally {
    await context.close()
  }
})

test('mobile canvas fills the viewport, searches and inserts logos while keeping navigation and PNG export reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await openDrawing(page)
  const stage = page.locator('.drawing-stage')
  expect(await stage.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
  expect((await stage.boundingBox())!.height).toBeGreaterThan(500)
  await page.getByRole('button', { name: '技术 Logo', exact: true }).click()
  await page.getByLabel('素材分类', { exact: true }).selectOption('containers')
  await page.getByLabel('搜索 Logo', { exact: true }).fill('kubernetes')
  await expect(page.locator('.drawing-logo-grid button')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '插入 Helm Logo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '插入 Kubernetes Logo', exact: true }).click()
  await expect(page.getByRole('complementary', { name: '技术 Logo 素材' })).toHaveCount(0)
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await stage.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
})

test('system clipboard pastes editable text and images with undo, export and reload while preserving text inputs', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./')
  await openDrawing(page)
  const text = '主服务器 → GPU\nTTS 与视频生成'
  await page.evaluate(value => navigator.clipboard.writeText(value), text)
  // Pasting works immediately after opening the tab, without an extra canvas click.
  await page.keyboard.press('Control+v')
  await expect.poll(async () => (await scene(page)).elements.map(element => element.text)).toEqual([text])
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(0)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(async () => (await scene(page)).elements[0]?.text).toBe(text)
  await page.keyboard.press('Enter')
  const editor = page.locator('.excalidraw-wysiwyg')
  await expect(editor).toBeVisible()
  await editor.press('Control+End')
  await page.evaluate(() => navigator.clipboard.writeText(' · 可编辑'))
  await page.keyboard.press('Control+v')
  await expect(editor).toHaveValue(`${text} · 可编辑`)
  await page.keyboard.press('Escape')
  expect((await scene(page)).elements).toHaveLength(1)
  await page.getByLabel('搜索 Logo', { exact: true }).focus()
  await page.evaluate(() => navigator.clipboard.writeText('PostgreSQL'))
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('搜索 Logo', { exact: true })).toHaveValue('PostgreSQL')
  expect((await scene(page)).elements).toHaveLength(1)
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 80
    const context = canvas.getContext('2d')!
    context.fillStyle = '#e16424'
    context.fillRect(0, 0, 160, 80)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  })
  await page.getByRole('button', { name: '技术 Logo', exact: true }).focus()
  await page.keyboard.press('Control+v')
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'image').length).toBe(1)
  const image = (await scene(page)).elements.find(element => element.type === 'image')!
  expect(image.width / image.height).toBe(2)
  expect((await scene(page)).files[image.fileId!].mimeType).toBe('image/png')
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'image').length).toBe(0)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  const png = await downloadBytes(page, '导出 PNG')
  expect([...png.bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const backup = JSON.parse((await downloadBytes(page, '下载画布文件')).bytes.toString('utf8'))
  expect(backup.elements).toHaveLength(2)
  expect(backup.files[image.fileId!]).toBeDefined()
  await page.reload()
  await openDrawing(page)
  await expect.poll(async () => (await scene(page)).elements.length).toBe(2)
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('paste preserves native scene copying and reports corrupt images without changing the drawing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./')
  await openDrawing(page)
  await draw(page, 'rectangle', [340, 200], [520, 340])
  await selectTool(page, 'selection')
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await page.mouse.click(box.x + 400, box.y + 200)
  await page.keyboard.press('Control+c')
  await page.mouse.move(box.x + 700, box.y + 400)
  await page.keyboard.press('Control+v')
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'rectangle').length).toBe(2)
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.items.add(new File(['not a PNG'], 'broken.png', { type: 'image/png' }))
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('alert')).toContainText('粘贴失败')
  expect((await scene(page)).elements).toHaveLength(2)
})

test('SVG palette groups every asset by category and supports folding, searching and mobile insertion', async ({ page }) => {
  await page.goto('./')
  await openDrawing(page)
  const groups = page.locator('.drawing-logo-group')
  await expect(groups).toHaveCount(Object.keys(drawingCategories).length)
  for (const [id, name] of Object.entries(drawingCategories)) {
    const group = page.getByRole('region', { name, exact: true })
    await expect(group.locator('.drawing-logo-grid button')).toHaveCount(drawingLogos.filter(icon => icon.category === id).length)
    await expect(group.locator('.drawing-group-heading small')).toHaveText(String(drawingLogos.filter(icon => icon.category === id).length))
  }
  await page.getByRole('button', { name: '收起全部分组', exact: true }).click()
  await expect(page.locator('.drawing-group-heading[aria-expanded="false"]')).toHaveCount(8)
  await expect(page.locator('.drawing-logo-grid button:visible')).toHaveCount(0)
  const data = page.getByRole('region', { name: '数据库与消息', exact: true })
  await data.locator('.drawing-group-heading').click()
  await expect(data.getByRole('button', { name: '插入 PostgreSQL Logo', exact: true })).toBeVisible()
  await page.getByLabel('搜索 Logo', { exact: true }).fill('PostgreSQL')
  await expect(groups).toHaveCount(new Set(filterDrawingLogos('PostgreSQL').map(icon => icon.category)).size)
  await expect(page.locator('.drawing-group-heading[aria-expanded="false"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '插入 PostgreSQL Logo', exact: true })).toBeVisible()
  await page.getByLabel('搜索 Logo', { exact: true }).fill('')
  await page.getByRole('button', { name: '收起全部分组', exact: true }).click()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-groups-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('素材分类', { exact: true }).selectOption('containers')
  await expect(groups).toHaveCount(1)
  await expect(page.locator('.drawing-group-heading')).toHaveAttribute('aria-expanded', 'true')
  await page.screenshot({ path: '.impeccable/review/topology-drawing-groups-mobile.png', animations: 'disabled' })
  await page.getByRole('button', { name: '插入 Kubernetes Logo', exact: true }).click()
  await expect(page.locator('.drawing-save-status')).toContainText('1 个元素')
  await expect(page.getByRole('complementary', { name: '技术 Logo 素材' })).toHaveCount(0)
})

test('expanded SVG library filters Alibaba services, renders transparent assets and exports them alongside brand logos', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./')
  await openDrawing(page)
  const palette = page.getByRole('complementary', { name: '技术 Logo 素材' })
  await expect(page.locator('.drawing-logo-grid button')).toHaveCount(drawingLogos.length)
  await expect(page.locator('.drawing-logo-count')).toContainText(`${drawingLogos.length} / ${drawingLogos.length}`)
  const assets = await page.evaluate(async paths => {
    const results: { path: string; painted: boolean; transparentCorner: boolean }[] = []
    for (let offset = 0; offset < paths.length; offset += 12) {
      results.push(...await Promise.all(paths.slice(offset, offset + 12).map(async path => {
        const image = new Image()
        image.src = new URL(path, document.baseURI).href
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 96
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0, 96, 96)
        const pixels = context.getImageData(0, 0, 96, 96).data
        return { path, painted: pixels.some((value, index) => index % 4 === 3 && value > 0), transparentCorner: pixels[3] === 0 }
      })))
    }
    return results
  }, drawingLogos.map(icon => icon.src))
  expect(assets.filter(asset => !asset.painted)).toEqual([])
  expect(assets.filter(asset => asset.path.includes('/aliyun-') && !asset.transparentCorner)).toEqual([])
  await page.getByLabel('素材分类', { exact: true }).selectOption('alibaba')
  await expect(palette).toContainText('非官方图标')
  await page.getByLabel('搜索 Logo', { exact: true }).fill('aliyun 对象存储')
  await expect(page.locator('.drawing-logo-grid button')).toHaveCount(1)
  await expect(page.locator('.drawing-logo-grid small')).toHaveText('服务示意')
  await page.getByRole('button', { name: '插入 阿里云 OSS · 对象存储 Logo', exact: true }).click()
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  await page.getByLabel('搜索 Logo', { exact: true }).fill('Qwen')
  await expect(page.getByRole('button', { name: '插入 Qwen Logo', exact: true }).locator('small')).toHaveText('品牌 Logo')
  const transfer = await page.evaluateHandle(() => new DataTransfer())
  await page.getByRole('button', { name: '插入 Qwen Logo', exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer })
  const target = page.locator('.drawing-stage canvas.interactive')
  const box = (await target.boundingBox())!
  await target.dispatchEvent('drop', { dataTransfer: transfer, clientX: box.x + 360, clientY: box.y + 300 })
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  await page.getByLabel('搜索 Logo', { exact: true }).fill('not-a-service')
  await expect(palette).toContainText('没有匹配的 Logo')
  await page.getByLabel('搜索 Logo', { exact: true }).fill('')
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-library-desktop.png', animations: 'disabled' })
  const png = await downloadBytes(page, '导出 PNG')
  expect([...png.bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const backup = await downloadBytes(page, '下载画布文件')
  expect(Object.keys(JSON.parse(backup.bytes.toString('utf8')).files)).toHaveLength(2)
  await page.reload()
  await openDrawing(page)
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  await expect.poll(() => coloredScenePixels(page)).toBeGreaterThan(100)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('素材分类', { exact: true }).selectOption('alibaba')
  await page.screenshot({ path: '.impeccable/review/topology-drawing-library-mobile.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByLabel('搜索 Logo', { exact: true }).fill('ECS')
  await page.getByRole('button', { name: '插入 阿里云 ECS · 云服务器 Logo', exact: true }).click()
  await expect(palette).toHaveCount(0)
  await expect(page.locator('.drawing-save-status')).toContainText('3 个元素')
})

test('component ports create native source-to-target arrows, follow moved shapes and support undo, styles, export and reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await openDrawing(page)
  await draw(page, 'rectangle', [340, 200], [520, 340])
  await draw(page, 'rectangle', [740, 200], [920, 340])
  await selectTool(page, 'selection')
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await page.mouse.click(box.x + 400, box.y + 200)
  await expect(page.locator('.drawing-connect-anchor')).toHaveCount(4)
  const [source, target] = (await scene(page)).elements
  await connectFromPort(page, '右', { x: box.x + 740, y: box.y + 270 })
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'arrow').length).toBe(1)
  const created = (await scene(page)).elements.find(element => element.type === 'arrow')!
  expect(created.startBinding?.elementId).toBe(source.id)
  expect(created.endBinding?.elementId).toBe(target.id)
  expect(created.startBinding!.fixedPoint![0]).toBeCloseTo(1, 3)
  expect(created.startBinding!.fixedPoint![1]).toBeCloseTo(0.5, 3)
  expect(created.endBinding!.fixedPoint![0]).toBeCloseTo(0, 3)
  expect(created.endBinding!.fixedPoint![1]).toBeCloseTo(0.5, 3)
  expect(created.startArrowhead).toBeNull()
  expect(created.endArrowhead).toBe('arrow')
  expect(created.elbowed).toBe(true)
  expect(Math.hypot(created.x + created.points![0][0] - source.x - source.width, created.y + created.points![0][1] - source.y - source.height / 2)).toBeLessThanOrEqual(6)
  expect(Math.hypot(created.x + created.points!.at(-1)![0] - target.x, created.y + created.points!.at(-1)![1] - target.y - target.height / 2)).toBeLessThanOrEqual(6)
  expect(created.points!.every((point, index, points) => !index || point[0] === points[index - 1][0] || point[1] === points[index - 1][1])).toBe(true)
  for (const id of [source.id, target.id]) expect((await scene(page)).elements.find(element => element.id === id)!.boundElements).toContainEqual({ type: 'arrow', id: created.id })
  await page.locator('.drawing-stage .excalidraw').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'arrow').length).toBe(0)
  for (const element of (await scene(page)).elements) expect(element.boundElements ?? []).not.toContainEqual({ type: 'arrow', id: created.id })
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByRole('group', { name: '连线设置', exact: true })).toBeVisible()
  await page.getByLabel('连线线型', { exact: true }).selectOption('dashed')
  await page.getByLabel('连线箭头', { exact: true }).selectOption('both')
  await expect.poll(async () => (await scene(page)).elements.find(element => element.id === created.id)!.strokeStyle).toBe('dashed')
  expect((await scene(page)).elements.find(element => element.id === created.id)).toMatchObject({ startArrowhead: 'arrow', endArrowhead: 'arrow' })
  await page.getByLabel('连线箭头', { exact: true }).selectOption('none')
  expect((await scene(page)).elements.find(element => element.id === created.id)).toMatchObject({ startArrowhead: null, endArrowhead: null })
  await page.getByLabel('连线箭头', { exact: true }).selectOption('end')
  await page.mouse.move(box.x + 800, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 840, box.y + 230, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => (await scene(page)).elements.find(element => element.id === target.id)!.x).not.toBe(target.x)
  const moved = (await scene(page)).elements.find(element => element.id === created.id)!
  expect(moved.endBinding?.elementId).toBe(target.id)
  expect([moved.x, moved.y, moved.points]).not.toEqual([created.x, created.y, created.points])
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-drawing-anchors-desktop.png', animations: 'disabled' })
  const backup = await downloadBytes(page, '下载画布文件')
  expect(JSON.parse(backup.bytes.toString('utf8')).elements.find((element: SceneElement) => element.id === created.id)).toMatchObject({ strokeStyle: 'dashed', endArrowhead: 'arrow' })
  const png = await downloadBytes(page, '导出 PNG')
  expect(png.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  await page.reload()
  await openDrawing(page)
  expect((await scene(page)).elements.find(element => element.id === created.id)).toMatchObject({ startBinding: { elementId: source.id }, endBinding: { elementId: target.id }, strokeStyle: 'dashed' })
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  expect(errors).toEqual([])
})

test('logo ports bind images in the drag direction, cancel empty drops and offer a keyboard-accessible target picker', async ({ page }) => {
  await page.goto('./')
  await openDrawing(page)
  const box = (await page.locator('.drawing-stage').boundingBox())!
  await dropLogo(page, 'PostgreSQL', box.x + 360, box.y + 250)
  await dropLogo(page, 'React', box.x + 800, box.y + 400)
  await expect(page.locator('.drawing-save-status')).toContainText('2 个元素')
  const images = (await scene(page)).elements
  const postgres = images.find(element => element.customData?.logo === 'PostgreSQL')!
  const react = images.find(element => element.customData?.logo === 'React')!
  await connectFromPort(page, '左', { x: box.x + 360, y: box.y + 250 })
  const arrow = (await scene(page)).elements.find(element => element.type === 'arrow')!
  expect(arrow).toMatchObject({ startBinding: { elementId: react.id }, endBinding: { elementId: postgres.id }, startArrowhead: null, endArrowhead: 'arrow' })
  await page.mouse.click(box.x + 800, box.y + 400)
  const port = page.getByRole('button', { name: '从下侧锚点连线', exact: true })
  await port.hover()
  await page.mouse.down()
  await page.mouse.move(box.x + 1000, box.y + 650, { steps: 8 })
  await page.mouse.up()
  expect((await scene(page)).elements.filter(element => element.type === 'arrow')).toHaveLength(1)
  await port.hover()
  await page.mouse.down()
  await page.mouse.move(box.x + 360, box.y + 250, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect((await scene(page)).elements.filter(element => element.type === 'arrow')).toHaveLength(1)
  await draw(page, 'rectangle', [420, 500], [600, 620])
  const rectangle = (await scene(page)).elements.find(element => element.type === 'rectangle')!
  await selectTool(page, 'selection')
  await page.mouse.click(box.x + 800, box.y + 400)
  await port.focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('连线终点', { exact: true }).selectOption(rectangle.id)
  await page.getByRole('button', { name: '创建连线', exact: true }).click()
  await expect.poll(async () => (await scene(page)).elements.filter(element => element.type === 'arrow').length).toBe(2)
  expect((await scene(page)).elements.filter(element => element.type === 'arrow')[1]).toMatchObject({ startBinding: { elementId: react.id }, endBinding: { elementId: rectangle.id } })
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
