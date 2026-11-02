import { test, expect } from '@playwright/test'
import seed from './fixture.ts'
import { mkdir } from 'node:fs/promises'

const editUrl = 'https://github.com/THU-MEM/ArchitecturePlanner/edit/main/src/seed-plan.json'

test.beforeEach(async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
})

test('one click copies the complete edited JSON and opens the GitHub editor without API writes or credentials', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const writes: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method()) || request.url().startsWith('https://api.github.com/')) writes.push(request.url())
  })
  await page.route(editUrl, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>GitHub editor destination</title>' }))
  await page.goto('./')
  await page.getByLabel('模块名称').fill('中文规划与分工')
  await page.getByLabel('主 owner').selectOption('github-101')
  await page.getByLabel('协作 owner example-helper').check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  const postgres = seed.components.find(component => component.id === 'postgres')!
  await page.getByRole('button', { name: `${postgres.id} ${postgres.name}`, exact: true }).click()
  await page.getByLabel('主 owner').selectOption('github-202')
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!))
  await page.getByRole('button', { name: '提交到 GitHub', exact: true }).click()
  await expect(page.getByLabel('GitHub Token')).toHaveCount(0)
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await page.getByRole('button', { name: '复制并前往 GitHub', exact: true }).click()
  await expect(page).toHaveURL(editUrl)
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
  expect(copied).toEqual(draft)
  expect(copied.modules.find((module: { id: string }) => module.id === 'M01').name).toBe('中文规划与分工')
  expect(copied.modules.find((module: { id: string }) => module.id === 'M01').owners).toEqual([
    { personId: 'github-101', role: 'primary' }, { personId: 'github-202', role: 'secondary' },
  ])
  expect(copied.components.find((component: { id: string }) => component.id === 'postgres').owners).toEqual([{ personId: 'github-202', role: 'primary' }])
  expect(writes).toEqual([])
  await page.goto('./')
  await expect(page.getByLabel('模块名称')).toHaveValue('项目输入与目标建模')
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('中文规划与分工')
})

test('clipboard denial keeps the draft on the page and offers manual copy, download and the native editor', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new DOMException('Permission denied', 'NotAllowedError') } } })
  })
  await page.goto('./')
  await page.getByLabel('模块名称').fill('Unsubmitted draft')
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '提交到 GitHub', exact: true }).click()
  await page.getByRole('button', { name: '复制并前往 GitHub', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('复制失败')
  expect(new URL(page.url()).hostname).toBe('127.0.0.1')
  await expect(page.getByLabel('模块名称')).toHaveValue('Unsubmitted draft')
  const manual = page.getByLabel('手动复制 JSON', { exact: true })
  await expect(manual).toBeVisible()
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!))
  expect(JSON.parse(await manual.inputValue())).toEqual(draft)
  await manual.focus()
  expect(await manual.evaluate(element => element instanceof HTMLTextAreaElement && element.selectionStart === 0 && element.selectionEnd === element.value.length)).toBe(true)
  await expect(page.getByRole('link', { name: '前往 GitHub 编辑', exact: true })).toHaveAttribute('href', editUrl)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出规划', exact: true }).click()
  const download = await downloaded
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(draft)
})

test('an unavailable clipboard has the same explicit manual recovery without navigating away', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined })
  })
  await page.goto('./')
  await page.getByLabel('模块名称').fill('Clipboard unavailable')
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '提交到 GitHub', exact: true }).click()
  await page.getByRole('button', { name: '复制并前往 GitHub', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('复制失败')
  await expect(page.getByLabel('手动复制 JSON', { exact: true })).toContainText('Clipboard unavailable')
  expect(new URL(page.url()).hostname).toBe('127.0.0.1')
})

test('published JSON is authoritative and local drafts are recovered only on request', async ({ page }) => {
  const draft = structuredClone(seed)
  draft.modules.find(module => module.id === 'M01')!.name = 'Older draft'
  await page.addInitScript(plan => {
    if (!localStorage.getItem('architecture-planner.plan.v1')) localStorage.setItem('architecture-planner.plan.v1', JSON.stringify(plan))
  }, draft)
  const published = structuredClone(seed)
  published.modules.find(module => module.id === 'M01')!.name = 'Reviewed and published'
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: published }))
  await page.goto('./')
  await expect(page.getByLabel('模块名称')).toHaveValue('Reviewed and published')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!).modules.find((module: { id: string }) => module.id === 'M01').name)).toBe('Older draft')
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('Older draft')
  await expect(page.locator('footer').getByRole('status')).toContainText('本地草稿')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '提交到 GitHub', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: '复制并前往 GitHub', exact: true })).toBeVisible()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/pr-mobile.png', fullPage: true, animations: 'disabled' })
})

test('a failed published JSON load shows an explicit error and can be retried', async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('503')
  await expect(page.getByLabel('模块名称')).toHaveCount(0)
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
  await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('项目输入与目标建模')
})
