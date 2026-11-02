import { test, expect } from '@playwright/test'
import seed from './fixture.ts'
import { mkdir } from 'node:fs/promises'

const api = 'https://api.github.com/repos/THU-MEM/ArchitecturePlanner'
const token = 'test-only-github-token-not-a-real-credential'
const commit = 'a'.repeat(40)
const blob = 'b'.repeat(40)

test.beforeEach(async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
})

test('submission creates one JSON-only branch and PR without publishing or storing credentials', async ({ page }) => {
  const requests: { method: string; path: string; body: Record<string, unknown> | null }[] = []
  let branch = ''
  await page.route(`${api}/**`, async route => {
    const request = route.request()
    expect(request.headers().authorization).toBe(`Bearer ${token}`)
    expect(request.headers().cookie).toBeUndefined()
    const path = request.url().slice(api.length)
    const body = request.postDataJSON()
    requests.push({ method: request.method(), path, body })
    if (path === '/git/ref/heads/main' && request.method() === 'GET') {
      return route.fulfill({ json: { ref: 'refs/heads/main', object: { type: 'commit', sha: commit } } })
    }
    if (path === `/contents/src/seed-plan.json?ref=${commit}` && request.method() === 'GET') {
      return route.fulfill({ json: { type: 'file', path: 'src/seed-plan.json', sha: blob } })
    }
    if (path === '/git/refs' && request.method() === 'POST') {
      expect(body.sha).toBe(commit)
      expect(body.ref).toMatch(/^refs\/heads\/planner\/[a-f0-9-]+$/)
      branch = body.ref.slice('refs/heads/'.length)
      return route.fulfill({ status: 201, json: { ref: body.ref, object: { type: 'commit', sha: commit } } })
    }
    if (path === '/contents/src/seed-plan.json' && request.method() === 'PUT') {
      expect(body.branch).toBe(branch)
      expect(body.sha).toBe(blob)
      expect(body.message).toContain('验证架构分工')
      return route.fulfill({ status: 200, json: { content: { sha: 'c'.repeat(40) }, commit: { sha: 'd'.repeat(40) } } })
    }
    if (path === '/pulls' && request.method() === 'POST') {
      expect(body.head).toBe(branch)
      expect(body.base).toBe('main')
      expect(body.title).toContain('验证架构分工')
      return route.fulfill({ status: 201, json: { number: 42, html_url: 'https://github.com/THU-MEM/ArchitecturePlanner/pull/42' } })
    }
    throw new Error(`Unexpected GitHub operation: ${request.method()} ${path}`)
  })
  await page.goto('./')
  await page.getByLabel('模块名称').fill('中文规划与分工')
  await page.getByLabel('主 owner').selectOption('github-101')
  await page.getByLabel('协作 owner example-helper').check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  await page.getByLabel('修改说明').fill('验证架构分工')
  await page.getByLabel('GitHub Token').fill(token)
  await page.getByRole('button', { name: '创建 Pull Request', exact: true }).click()
  await expect(page.getByRole('link', { name: '查看 PR', exact: true })).toHaveAttribute('href', 'https://github.com/THU-MEM/ArchitecturePlanner/pull/42')
  await expect(page.getByRole('status')).toContainText('合入后发布')
  await expect(page.getByLabel('GitHub Token')).toHaveValue('')
  const update = requests.find(request => request.method === 'PUT')!
  const submitted = JSON.parse(Buffer.from(String(update.body!.content), 'base64').toString('utf8'))
  expect(submitted.modules.find((module: { id: string }) => module.id === 'M01').name).toBe('中文规划与分工')
  expect(submitted.modules.find((module: { id: string }) => module.id === 'M01').owners).toEqual([
    { personId: 'github-101', role: 'primary' }, { personId: 'github-202', role: 'secondary' },
  ])
  expect(JSON.stringify(submitted)).not.toContain(token)
  expect(requests.map(request => request.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'POST'])
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(token)
  await page.reload()
  await expect(page.getByLabel('模块名称')).toHaveValue('项目输入与目标建模')
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('中文规划与分工')
})

test('GitHub authorization failure leaves the draft intact and exposes no secret', async ({ page }) => {
  let calls = 0
  await page.route(`${api}/**`, route => {
    calls++
    return route.fulfill({ status: 401, json: { message: 'Bad credentials' } })
  })
  await page.goto('./')
  await page.getByLabel('模块名称').fill('Unsubmitted draft')
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  await page.getByLabel('修改说明').fill('Update plan')
  await page.getByLabel('GitHub Token').fill(token)
  await page.getByRole('button', { name: '创建 Pull Request', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('401')
  await expect(page.getByRole('alert')).not.toContainText(token)
  await expect(page.getByLabel('模块名称')).toHaveValue('Unsubmitted draft')
  await expect(page.getByRole('link', { name: '查看 PR', exact: true })).toHaveCount(0)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  await expect(page.getByLabel('GitHub Token')).toHaveValue('')
})

test('a PR creation failure exposes the existing proposal branch without automatically retrying', async ({ page }) => {
  let branch = ''
  let calls = 0
  await page.route(`${api}/**`, route => {
    calls++
    const path = route.request().url().slice(api.length)
    if (path === '/git/ref/heads/main') return route.fulfill({ json: { object: { sha: commit } } })
    if (path.startsWith('/contents/') && route.request().method() === 'GET') return route.fulfill({ json: { type: 'file', sha: blob } })
    if (path === '/git/refs') {
      branch = route.request().postDataJSON().ref.slice('refs/heads/'.length)
      return route.fulfill({ status: 201, json: { ref: `refs/heads/${branch}` } })
    }
    if (path === '/contents/src/seed-plan.json') return route.fulfill({ json: { content: { sha: blob } } })
    return route.fulfill({ status: 422, json: { message: 'Validation Failed' } })
  })
  await page.goto('./')
  await page.getByLabel('模块名称').fill('Proposal draft')
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  await page.getByLabel('修改说明').fill('Update plan')
  await page.getByLabel('GitHub Token').fill(token)
  await page.getByRole('button', { name: '创建 Pull Request', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('422')
  await expect(page.getByRole('link', { name: '检查分支 / 手动创建 PR', exact: true })).toHaveAttribute('href', `https://github.com/THU-MEM/ArchitecturePlanner/compare/main...${branch}?expand=1`)
  await expect(page.getByLabel('模块名称')).toHaveValue('Proposal draft')
  expect(calls).toBe(5)
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
  await expect(page.getByRole('status')).toContainText('本地草稿')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '提交 PR', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByLabel('GitHub Token')).toBeVisible()
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
