import { test, expect } from '@playwright/test'
import seed from '../src/seed-plan.json' with { type: 'json' }
import { mkdir } from 'node:fs/promises'

test('icon-first controls and colorful technology logos support editable component assignments', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: '导出规划', exact: true }).locator('img')).toHaveCount(1)
  await expect(page.locator('.planner-node > p')).toHaveCount(0)
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Grafana', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Grafana', exact: true }).first()).toHaveCSS('filter', 'none')
  await page.getByRole('button', { name: '架构画布', exact: true }).click()
  await page.getByRole('button', { name: '添加组件', exact: true }).click()
  await page.getByRole('checkbox', { name: '技术组件 监控、日志与追踪', exact: true }).check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await expect(page.locator('.react-flow__node[data-id="M01"]').getByRole('img', { name: 'Grafana', exact: true })).toBeVisible()
})

test('technology components really retain primary and secondary owners after reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  for (const name of ['Alice', 'Bob']) {
    await page.getByLabel('成员姓名').fill(name)
    await page.getByRole('button', { name: '添加成员', exact: true }).click()
  }
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  const postgres = seed.components.find(component => component.id === 'postgres')!
  await page.getByRole('button', { name: `${postgres.id} ${postgres.name}`, exact: true }).click()
  await page.getByLabel('主 owner').selectOption({ label: 'Alice' })
  await page.getByLabel('协作 owner Bob').check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  await page.getByRole('button', { name: `${postgres.id} ${postgres.name}`, exact: true }).click()
  await expect(page.getByLabel('主 owner').locator('option:checked')).toHaveText('Alice')
  await expect(page.getByLabel('协作 owner Bob')).toBeChecked()
})

test('a nonempty search brings the matching module into the visible canvas', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('搜索模块').fill('M24')
  await expect(page.locator('.react-flow__node[data-id="M24"]')).toBeInViewport()
})

test('technology inspection preserves reverse navigation to referencing business modules', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  const postgres = seed.components.find(component => component.id === 'postgres')!
  await page.getByRole('button', { name: `${postgres.id} ${postgres.name}`, exact: true }).click()
  await page.getByRole('button', { name: '查看模块 M01', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue(seed.modules.find(module => module.id === 'M01')!.name)
})

test('workspace renders without page errors or viewport overflow at desktop and mobile sizes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '架构规划台' })).toBeVisible()
  await expect(page.locator('.react-flow__node[data-id="M05"]')).toBeVisible()
  await mkdir('.impeccable/review', { recursive: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.screenshot({ path: '.impeccable/review/desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '.impeccable/review/mobile.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(errors).toEqual([])
})

test('original modules, primary and secondary owner assignment, export and reload work together', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '架构规划台' })).toBeVisible()
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await page.getByLabel('成员姓名').fill('Alice')
  await page.getByRole('button', { name: '添加成员' }).click()
  await page.getByLabel('成员姓名').fill('Bob')
  await page.getByRole('button', { name: '添加成员' }).click()
  await page.getByRole('button', { name: '分工清单' }).click()
  await page.getByRole('button', { name: 'M01 项目输入与目标建模' }).click()
  await page.getByLabel('主 owner').selectOption({ label: 'Alice' })
  await page.getByLabel('协作 owner Bob').check()
  await page.getByLabel('模块名称').fill('项目建模')
  await page.getByRole('button', { name: '应用修改' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('Alice')
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('Bob')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出规划' }).click()
  const file = await download
  await expect(file.suggestedFilename()).toBe('architecture-plan.json')
  await page.reload()
  await page.getByRole('button', { name: '分工清单' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('项目建模')
})

test('shared loads refresh the inspector and persist locally without storing the token', async ({ page, request }) => {
  const headers = { Authorization: 'Bearer test-only-not-a-real-secret-1234567890' }
  const response = await request.get('http://127.0.0.1:8787/api/plan', { headers })
  const { revision } = await response.json()
  const plan = structuredClone(seed)
  const module = plan.modules.find(module => module.id === 'M01')!
  module.name = 'Shared module'
  plan.modules = [module, ...plan.modules.filter(module => module.id !== 'M01')]
  expect((await request.put('http://127.0.0.1:8787/api/plan', { headers, data: { revision, plan } })).status()).toBe(200)
  await page.goto('./')
  await page.getByRole('button', { name: '共享 API', exact: true }).click()
  await page.getByLabel('API 地址').fill('http://127.0.0.1:8787')
  await page.getByLabel('编辑 token').fill('test-only-not-a-real-secret-1234567890')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('http://127.0.0.1:8787/api/plan', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue()
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '读取共享规划' }).click()
  await expect(page.getByLabel('API 地址')).toBeDisabled()
  await expect(page.getByLabel('编辑 token')).toBeDisabled()
  release()
  await expect(page.getByLabel('模块名称')).toHaveValue('Shared module')
  const stored = await page.evaluate(() => JSON.stringify(localStorage))
  expect(stored).not.toContain('test-only-not-a-real-secret')
  await page.reload()
  await expect(page.getByLabel('模块名称')).toHaveValue('Shared module')
})

test('canvas layout, relationships and deletion persist in the exported plan', async ({ page }) => {
  await page.goto('./')
  const node = page.locator('.react-flow__node[data-id="M01"]')
  const box = await node.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(180)
  await page.mouse.move(box!.x + 60, box!.y + 35)
  await page.mouse.down()
  await page.mouse.move(box!.x + 120, box!.y + 65, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => {
    const draft = localStorage.getItem('architecture-planner.plan.v1')
    return draft ? JSON.parse(draft).modules.find((module: { id: string }) => module.id === 'M01').position.x : null
  })).not.toBe(seed.modules.find(module => module.id === 'M01')!.position.x)
  const source = await node.locator('.react-flow__handle.source').boundingBox()
  const target = await page.locator('.react-flow__node[data-id="M02"] .react-flow__handle.target').boundingBox()
  expect(source).not.toBeNull()
  expect(target).not.toBeNull()
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
  await page.mouse.down()
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.react-flow__edge').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
})

test('a shared revision conflict retains local edits and leaves the other writer intact', async ({ page, request }) => {
  const headers = { Authorization: 'Bearer test-only-not-a-real-secret-1234567890' }
  await page.goto('./')
  await page.getByRole('button', { name: '共享 API', exact: true }).click()
  await page.getByLabel('API 地址').fill('http://127.0.0.1:8787')
  await page.getByLabel('编辑 token').fill('test-only-not-a-real-secret-1234567890')
  await page.getByRole('button', { name: '读取共享规划' }).click()
  await expect(page.getByRole('status')).toContainText('共享规划已读取')
  await page.getByLabel('模块名称').fill('Local unsynced module')
  await page.getByRole('button', { name: '应用修改' }).click()
  const snapshot = await request.get('http://127.0.0.1:8787/api/plan', { headers }).then(response => response.json())
  snapshot.plan.name = 'Other writer'
  expect((await request.put('http://127.0.0.1:8787/api/plan', { headers, data: snapshot })).status()).toBe(200)
  await page.getByRole('button', { name: '保存到共享库' }).click()
  await expect(page.getByRole('alert')).toContainText('共享版本已变化')
  await expect(page.getByLabel('模块名称')).toHaveValue('Local unsynced module')
  expect((await request.get('http://127.0.0.1:8787/api/plan', { headers }).then(response => response.json())).plan.name).toBe('Other writer')
})

test('valid imports require explicit replacement of an edited draft', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('模块名称').fill('Local draft')
  await page.getByRole('button', { name: '应用修改' }).click()
  const imported = { ...seed, name: 'Imported plan' }
  const file = { name: 'plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) }
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByRole('button', { name: '确认替换草稿' })).toBeVisible()
  await page.getByRole('button', { name: '保留当前草稿' }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('Local draft')
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('button', { name: '确认替换草稿' }).click()
  await expect(page.getByText('Imported plan', { exact: true })).toBeVisible()
})

test('invalid imported data surfaces an error and does not replace the current architecture', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') })
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '分工清单' }).click()
  await expect(page.getByRole('row')).toHaveCount(25)
})

test('filter empty state and original architecture views remain reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await page.getByRole('button', { name: '分工清单' }).click()
  await page.getByLabel('搜索模块').fill('no-such-module')
  await expect(page.getByText('没有匹配的模块')).toBeVisible()
  await page.getByLabel('搜索模块').fill('')
  await page.getByRole('button', { name: '原始架构' }).click()
  const viewer = page.frameLocator('iframe[title="AI-MEM 原始架构"]')
  await expect(viewer.getByRole('button', { name: '总体架构', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
