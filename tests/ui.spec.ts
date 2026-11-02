import { test, expect } from '@playwright/test'
import seed from './fixture.ts'
import { mkdir } from 'node:fs/promises'
import publishedPlan from '../src/seed-plan.json' with { type: 'json' }
import { technicalFacts, technicalFlows } from '../src/technical-architecture.ts'

test.beforeEach(async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: seed }))
})

test('configured GitHub participants are immediately available and can own modules and components', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await expect(page.locator('.team-list li')).toHaveCount(2)
  await expect(page.locator('.banner-context .view-count')).toHaveText('2')
  await expect(page.locator('.team-list')).toContainText('example-owner')
  await expect(page.locator('.team-list')).toContainText('example-helper')
  await page.getByLabel('成员姓名').fill('Existing owner')
  await page.getByRole('button', { name: '添加成员', exact: true }).click()
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  await page.getByRole('button', { name: 'M01 项目输入与目标建模', exact: true }).click()
  await page.getByLabel('主 owner').selectOption({ label: 'Existing owner' })
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await expect(page.locator('.team-list li')).toHaveCount(3)
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('Existing owner')
  await page.getByRole('button', { name: 'M02 自适应测评', exact: true }).click()
  await page.getByLabel('主 owner').selectOption({ label: 'example-owner' })
  await page.getByLabel('协作 owner example-helper').check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  const postgres = seed.components.find(component => component.id === 'postgres')!
  await page.getByRole('button', { name: `${postgres.id} ${postgres.name}`, exact: true }).click()
  await page.getByLabel('主 owner').selectOption({ label: 'example-helper' })
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!))
  expect(saved.modules.find((module: { id: string }) => module.id === 'M02').owners).toEqual([{ personId: 'github-101', role: 'primary' }, { personId: 'github-202', role: 'secondary' }])
  expect(saved.components.find((component: { id: string }) => component.id === 'postgres').owners).toEqual([{ personId: 'github-202', role: 'primary' }])
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await expect(page.locator('.team-list li')).toHaveCount(3)
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/team-mobile.png', fullPage: true, animations: 'disabled' })
})

test('team member names open confirmed GitHub profiles without turning manual names into guessed accounts', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  const profile = page.locator('.team-list').getByRole('link', { name: 'example-owner', exact: true })
  await expect(profile).toHaveAttribute('href', 'https://github.com/example-owner')
  await expect(profile).toHaveAttribute('target', '_blank')
  await expect(profile).toHaveAttribute('rel', 'noreferrer')
  await page.context().route('https://github.com/example-owner', route => route.fulfill({ contentType: 'text/html', body: '<title>GitHub profile</title>' }))
  const popupOpened = page.waitForEvent('popup')
  await profile.click()
  const popup = await popupOpened
  await expect(popup).toHaveURL('https://github.com/example-owner')
  await popup.close()
  await page.getByLabel('成员姓名').fill('Alice')
  await page.getByRole('button', { name: '添加成员', exact: true }).click()
  await expect(page.locator('.team-list li').filter({ hasText: 'Alice' }).getByRole('link')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(profile).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test('local initials avatars identify participants and follow applied module and component ownership', async ({ page }) => {
  const externalImages: string[] = []
  page.on('request', request => {
    if (request.resourceType() === 'image' && /^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalImages.push(request.url())
  })
  await page.goto('./')
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await expect(page.locator('.team-list img.avatar')).toHaveCount(2)
  const ownerAvatar = page.locator('.team-list').getByRole('img', { name: 'example-owner 的头像', exact: true })
  const helperAvatar = page.locator('.team-list').getByRole('img', { name: 'example-helper 的头像', exact: true })
  await expect(ownerAvatar).toHaveAttribute('src', /^data:image\/svg\+xml/)
  const ownerSource = await ownerAvatar.getAttribute('src')
  const helperSource = await helperAvatar.getAttribute('src')
  expect(helperSource).not.toBe(ownerSource)
  expect(await ownerAvatar.evaluate((image: HTMLImageElement) => new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml').querySelector('text')?.textContent)).toBe('EO')
  expect(await ownerAvatar.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy()
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await page.getByRole('button', { name: '业务架构', exact: true }).click()
  const node = page.locator('.react-flow__node[data-id="M01"]')
  await expect(node.locator('img.avatar')).toHaveCount(0)
  await page.getByLabel('主 owner').selectOption({ label: 'example-owner' })
  await page.getByLabel('协作 owner example-helper').check()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await expect(node.getByRole('img', { name: '主 owner example-owner 的头像', exact: true })).toHaveAttribute('src', ownerSource!)
  await expect(node.getByRole('img', { name: '协作 owner example-helper 的头像', exact: true })).toHaveAttribute('src', helperSource!)
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'M01' })
  await expect(row.getByRole('img', { name: '主 owner example-owner 的头像', exact: true })).toBeVisible()
  await expect(row).toContainText('example-helper')
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  const component = seed.components.find(component => component.id === 'postgres')!
  const tile = page.getByRole('button', { name: `${component.id} ${component.name}`, exact: true })
  await tile.click()
  await page.getByLabel('主 owner').selectOption({ label: 'example-helper' })
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await expect(tile.getByRole('img', { name: '主 owner example-helper 的头像', exact: true })).toHaveAttribute('src', helperSource!)
  await page.reload()
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await expect(node.getByRole('img', { name: '主 owner example-owner 的头像', exact: true })).toHaveAttribute('src', ownerSource!)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('搜索模块').fill('M01')
  await expect(node).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/avatars-mobile.png', fullPage: true, animations: 'disabled' })
  await page.getByLabel('主 owner').selectOption('')
  await page.getByLabel('协作 owner example-helper').uncheck()
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  await expect(node.locator('img.avatar')).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!))
  expect(saved.modules.find((module: { id: string }) => module.id === 'M01').owners).toEqual([])
  expect(saved.people).toEqual([{ id: 'github-101', name: 'example-owner' }, { id: 'github-202', name: 'example-helper' }])
  expect(externalImages).toEqual([])
})

test('all assigned avatars fit a module even when its technology logos fill the footer', async ({ page }) => {
  const plan = structuredClone(seed)
  plan.people = Array.from({ length: 32 }, (_, index) => ({ id: `owner-${index}`, name: `Owner ${index}` }))
  const module = plan.modules.find(module => module.id === 'M01')!
  module.components = plan.components.map(component => component.id)
  module.owners = plan.people.map((person, index) => ({ personId: person.id, role: index ? 'secondary' : 'primary' }))
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  const node = page.locator('.react-flow__node[data-id="M01"]')
  await expect(node.locator('img.avatar')).toHaveCount(32)
  expect(await node.evaluate(element => {
    const box = element.getBoundingClientRect()
    return [...element.querySelectorAll('img.avatar')].every(image => {
      const avatar = image.getBoundingClientRect()
      return avatar.width > 0 && avatar.left >= box.left && avatar.right <= box.right && avatar.top >= box.top && avatar.bottom <= box.bottom
    })

  })).toBeTruthy()
})

test('authorized avatar initials render consistently across team, ownership editor, canvas and list without changing plan data', async ({ page }) => {
  const plan = structuredClone(seed)
  plan.people = [{ id: 'github-8344245', name: 'HydraXman' }]
  plan.modules.find(module => module.id === 'M01')!.owners = [{ personId: 'github-8344245', role: 'primary' }]
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  const canvasAvatar = page.locator('.react-flow__node[data-id="M01"]').getByRole('img', { name: '主 owner HydraXman 的头像', exact: true })
  await expect(canvasAvatar).toBeVisible()
  expect(await canvasAvatar.evaluate((image: HTMLImageElement) => new DOMParser().parseFromString(decodeURIComponent(image.src.split(',')[1]), 'image/svg+xml').querySelector('text')?.textContent)).toBe('BS')
  const source = await canvasAvatar.getAttribute('src')
  await expect(page.locator('.owner-options').getByRole('img', { name: 'HydraXman 的头像', exact: true })).toHaveAttribute('src', source!)
  await page.getByRole('button', { name: '团队成员', exact: true }).click()
  await expect(page.locator('.team-list').getByRole('img', { name: 'HydraXman 的头像', exact: true })).toHaveAttribute('src', source!)
  await expect(page.locator('.team-list').getByRole('link', { name: 'HydraXman', exact: true })).toHaveAttribute('href', 'https://github.com/HydraXman')
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' }).getByRole('img', { name: '主 owner HydraXman 的头像', exact: true })).toHaveAttribute('src', source!)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出规划', exact: true }).click()
  const stream = await (await download).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).people).toEqual([
    ...plan.people,
    { id: 'github-101', name: 'example-owner' },
    { id: 'github-202', name: 'example-helper' },
  ])
})

test('current architecture distinguishes implemented identity and balance flows from planned client integration', async ({ page }) => {
  const draft = structuredClone(seed)
  draft.people = [{ id: 'alice', name: 'Alice' }]
  draft.modules.find(module => module.id === 'M01')!.owners = [{ personId: 'alice', role: 'primary' }]
  await page.addInitScript(plan => localStorage.setItem('architecture-planner.plan.v1', JSON.stringify(plan)), draft)
  await page.goto('./')
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await page.getByRole('button', { name: '技术架构', exact: true }).click()
  await page.getByLabel('技术架构范围').selectOption('all')
  await expect(page.getByRole('heading', { name: '技术架构 · Kubernetes · 服务与数据', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await expect(page.getByText('源码已实现 ≠ 生产已上线', { exact: true })).toBeVisible()
  await expect(page.locator('[data-flow="sso-balance"]')).toHaveAttribute('data-evidence', 'source')
  await expect(page.locator('[data-flow="client-model"]')).toHaveAttribute('data-evidence', 'planned')
  await expect(page.locator('[data-project="sso-console"]')).toContainText('keycloak-js')
  await expect(page.locator('[data-flow="event-track"]')).toHaveAttribute('aria-label', 'Edge from sso-identity to sso-events')
  await expect(page.locator('[data-flow="client-events"]')).toHaveAttribute('data-evidence', 'planned')
  await expect(page.locator('[data-project="mem-gateway"]')).toContainText('MEM-AI')
  await page.getByRole('button', { name: '查看现状 余额接入', exact: true }).click()
  await expect(page.getByRole('region', { name: '项目实现详情' }).getByText('client_credentials · balance:read', { exact: true })).toBeVisible()
  await expect(page.getByText('服务凭证仅用于余额查询，不是模型 API key，也不是用户 SSO token。', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '分配组件 usage-service', exact: true }).click()
  await expect(page.getByRole('heading', { name: seed.components.find(component => component.id === 'usage-service')!.name, exact: true })).toBeVisible()
  await page.getByLabel('主 owner').selectOption({ label: 'Alice' })
  await page.getByRole('button', { name: '应用修改', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!).components.find((component: { id: string }) => component.id === 'usage-service').owners)).toEqual([{ personId: 'alice', role: 'primary' }])
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('Alice')
})

test('current project navigation frames the selected component on mobile without changing the planning draft', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await page.getByRole('button', { name: '技术架构', exact: true }).click()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-technical-desktop.png', animations: 'disabled' })
  const map = await page.locator('.current-map').boundingBox()
  expect(Math.abs(map!.y + map!.height - 900)).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('项目组件').selectOption('mem-gateway')
  await page.getByRole('button', { name: '查看现状 MEM-AI 模型网关', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.locator('[data-project="mem-gateway"]')).toBeInViewport()
  await expect(page.getByRole('region', { name: '项目实现详情' }).getByRole('heading', { name: 'MEM-AI 模型网关', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await page.locator('.current-map').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '.impeccable/review/topology-technical-mobile.png', animations: 'disabled' })
  expect(errors).toEqual([])
})

test('current architecture connectors do not pass through unrelated components', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '技术架构', exact: true }).click()
  await page.getByLabel('技术架构范围').selectOption('all')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await expect(page.locator('.current-map .react-flow__edge-path')).toHaveCount(technicalFlows.length)
  const intersections = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-project]')].map(node => ({ id: node.dataset.project!, box: node.getBoundingClientRect() }))
    const collisions = new Set<string>()
    for (const edge of document.querySelectorAll<SVGGElement>('[data-flow]')) {
      const endpoints = edge.getAttribute('aria-label')!.match(/^Edge from (\S+) to (\S+)$/)!
      const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')!
      const matrix = path.getScreenCTM()!
      for (let distance = 0; distance <= path.getTotalLength(); distance += 4) {
        const point = path.getPointAtLength(distance).matrixTransform(matrix)
        for (const node of nodes) {
          if (node.id !== endpoints[1] && node.id !== endpoints[2] && point.x > node.box.left + 4 && point.x < node.box.right - 4 && point.y > node.box.top + 4 && point.y < node.box.bottom - 4) {
            collisions.add(`${edge.dataset.flow} crosses ${node.id}`)
          }
        }
      }
    }
    return [...collisions]
  })
  expect(intersections).toEqual([])
})

test('business and technical navigation preserves the plan and distinguishes runtime readiness from source evidence', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '规划视图' }).getByRole('button')
  await expect(navigation).toHaveCount(6)
  await expect(navigation.nth(0)).toHaveAccessibleName('业务架构')
  await expect(navigation.nth(1)).toHaveAccessibleName('技术架构')
  await expect(navigation.nth(0)).toHaveAttribute('aria-current', 'page')
  await navigation.nth(1).click()
  await expect(page.getByLabel('技术架构范围')).toHaveValue('runtime')
  await page.getByLabel('技术架构范围').selectOption('all')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await expect(page.locator('[data-project]')).toHaveCount(technicalFacts.length)
  await expect(page.locator('[data-project="kubernetes"]')).toHaveAttribute('data-runtime', 'ready')
  await expect(page.locator('[data-project="sso-identity"]')).toHaveAttribute('data-runtime', 'ready')
  await expect(page.locator('[data-project="sso-hub"]')).toHaveAttribute('data-runtime', 'not-observed')
  await expect(page.locator('[data-project="mem-gateway"]')).toHaveAttribute('data-runtime', 'ready')
  await expect(page.locator('[data-flow="identity-route"]')).toHaveAttribute('data-evidence', 'observed')
  await page.getByLabel('项目组件').selectOption('mem-gateway')
  const detail = page.getByRole('region', { name: '项目实现详情' })
  await expect(detail).toContainText('Deployment 1/1')
  await expect(detail).toContainText('Service 3000 有 1 个就绪端点')
  await expect(page.locator('[data-project="apisix"]')).toHaveClass(/node-upstream/)
  await expect(page.locator('[data-project="mem-postgres"]')).toHaveClass(/node-downstream/)
  await expect(page.locator('[data-project="mem-postgres"]')).toHaveAttribute('data-runtime', 'ready')
  await expect(page.locator('[data-flow="model-postgres"]')).toHaveAttribute('data-evidence', 'observed')
  await expect(page.locator('[data-flow="model-db-instance"]')).toHaveAttribute('data-evidence', 'observed')
  await expect(page.locator('[data-flow="postgres-volume"]')).toHaveAttribute('data-evidence', 'observed')
  await expect(page.locator('[data-flow="model-files-volume"]')).toHaveAttribute('data-evidence', 'observed')
  await page.getByRole('button', { name: '查看现状 MEM-AI 模型网关', exact: true }).click()
  await expect(page.getByLabel('项目组件')).toHaveValue('')
  await expect(page.locator('.current-map .node-dimmed')).toHaveCount(0)
  await page.getByLabel('技术架构范围').selectOption('runtime')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await expect(page.locator('[data-project]')).toHaveCount(technicalFacts.filter(fact => fact.runtime === 'ready' || fact.runtime === 'blocked').length)
  await page.getByLabel('项目组件').selectOption('mem-postgres')
  await expect(detail).toContainText('MEM-AI 弃用 SQLite')
  await expect(detail).toContainText('数据库侧可见 1 个该逻辑库连接')
  await expect(detail.getByRole('heading', { name: '网关 PostgreSQL', exact: true })).toBeVisible()
  await page.getByLabel('项目组件').selectOption('')
  const infrastructure = page.getByRole('region', { name: '基础设施现场证据' })
  await expect(infrastructure.getByRole('button')).toHaveCount(4)
  await expect(infrastructure).toContainText('Certificate 资源为 0')
  await expect(infrastructure).toContainText('Available=True')
  await infrastructure.getByRole('button', { name: '核对证书管理', exact: true }).click()
  await expect(page.getByLabel('项目组件')).toHaveValue('cert-manager')
  await expect(detail).toContainText('不能认定业务证书已由它签发')
  await page.getByLabel('项目组件').selectOption('')
  await expect(page.locator('[data-project="sso-hub"]')).toHaveCount(0)
  await page.getByRole('button', { name: '查看现状 Keycloak', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('项目组件')).toHaveValue('sso-identity')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('项目组件')).toHaveValue('')
  await page.getByRole('button', { name: '适应全图', exact: true }).click()
  await page.screenshot({ path: '.impeccable/review/topology-technical-runtime.png', animations: 'disabled' })
  await navigation.nth(0).click()
  await expect(page.getByLabel('模块名称')).toHaveValue(seed.modules.find(module => module.id === 'M01')!.name)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('selected card owners and direct neighbors light up in the inspector without changing assignments', async ({ page }) => {
  const plan = structuredClone(seed)
  plan.people = ['Current', 'Upstream', 'Downstream', 'Feedback', 'Other'].map(name => ({ id: name.toLowerCase(), name }))
  plan.modules = plan.modules.filter(module => ['M01', 'M02', 'M03', 'M04', 'M05'].includes(module.id))
  for (const [moduleId, personId] of [['M01', 'upstream'], ['M02', 'current'], ['M03', 'downstream'], ['M04', 'feedback'], ['M05', 'other']]) {
    plan.modules.find(module => module.id === moduleId)!.owners = [{ personId, role: 'primary' }]
  }
  plan.relationships = [
    { id: 'up', source: 'M01', target: 'M02' }, { id: 'down', source: 'M02', target: 'M03' },
    { id: 'out', source: 'M02', target: 'M04' }, { id: 'in', source: 'M04', target: 'M02' },
  ]
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await page.locator('.react-flow__node[data-id="M02"]').click()
  const owner = (name: string) => page.getByLabel(`协作 owner ${name}`, { exact: true }).locator('..')
  await expect(owner('Current')).toHaveClass(/person-current/)
  await expect(owner('Upstream')).toHaveClass(/person-upstream/)
  await expect(owner('Downstream')).toHaveClass(/person-downstream/)
  await expect(owner('Feedback')).toHaveClass(/person-upstream/)
  await expect(owner('Feedback')).toHaveClass(/person-downstream/)
  await expect(owner('Other')).toHaveClass(/person-unrelated/)
  await expect(owner('Upstream')).toHaveCSS('box-shadow', /rgba\(22, 75, 135,/)
  await expect(owner('Downstream')).toHaveCSS('box-shadow', /rgba\(255, 229, 153,/)
  await expect(page.getByLabel('主 owner').locator('option:checked')).toHaveText('Current')
  await expect(page.getByLabel('协作 owner Feedback', { exact: true })).not.toBeChecked()
  const upstream = page.getByRole('button', { name: '查看上游模块 M01', exact: true })
  await expect(upstream).toContainText('Upstream')
  await expect(upstream.getByRole('img', { name: '主 owner Upstream 的头像', exact: true })).toBeVisible()
  await page.screenshot({ path: '.impeccable/review/topology-owner-focus.png', animations: 'disabled' })
  await upstream.click()
  await expect(page.getByRole('button', { name: '业务架构', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.react-flow__node[data-id="M01"]')).toHaveClass(/selected/)
  await page.locator('.react-flow__node[data-id="M01"]').click()
  await expect(page.locator('.inspector .person-current, .inspector .person-upstream, .inspector .person-downstream')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('icon-first controls and colorful technology logos support editable component assignments', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: '导出规划', exact: true }).locator('img')).toHaveCount(1)
  await expect(page.locator('.planner-node > p')).toHaveCount(0)
  await page.getByRole('button', { name: '技术组件', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Grafana', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Grafana', exact: true }).first()).toHaveCSS('filter', 'none')
  await page.getByRole('button', { name: '业务架构', exact: true }).click()
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
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
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

test('compact banner and one-row navigation leave both canvases full-height without a left sidebar', async ({ page }) => {
  await mkdir('.impeccable/review', { recursive: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await page.goto('./')
    await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
    const navigation = page.getByRole('navigation', { name: '规划视图' })
    await expect(navigation.getByRole('button')).toHaveCount(6)
    expect(await navigation.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(44)
    expect(await navigation.getByRole('button').evaluateAll(elements => new Set(elements.map(element => element.getBoundingClientRect().top)).size)).toBe(1)
    expect(await page.locator('.app-header').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(viewport.width > 700 ? 52 : 80)
    await expect(page.locator('.sidebar, .workspace-heading, .view-heading, .privacy-note')).toHaveCount(0)
    const canvas = page.locator('.canvas')
    expect((await canvas.boundingBox())!.y).toBeLessThanOrEqual(240)
    expect((await canvas.boundingBox())!.x).toBe(0)
    expect(await canvas.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `.impeccable/review/topology-compact-business-${viewport.width}.png`, animations: 'disabled' })
    await navigation.getByRole('button', { name: '技术架构', exact: true }).click()
    await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
    await expect(page.locator('.app-header').getByRole('heading', { name: '技术架构 · Kubernetes · 服务与数据', exact: true })).toBeVisible()
    await expect(page.locator('.app-header .progress-label')).toContainText('已分配')
    await expect(page.locator('.current-heading')).toHaveCount(0)
    const map = page.locator('.current-map')
    expect((await map.boundingBox())!.y).toBeLessThanOrEqual(220)
    expect((await map.boundingBox())!.x).toBe(0)
    expect(await map.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `.impeccable/review/topology-compact-technical-${viewport.width}.png`, animations: 'disabled' })
    expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  }
})

test('canvas fills the desktop viewport while the inspector scrolls independently', async ({ page }) => {
  await page.goto('./')
  const canvas = page.locator('.canvas')
  await expect(canvas).toBeVisible()
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1200 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => canvas.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBeTruthy()
    await page.getByRole('button', { name: '应用修改', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: '应用修改', exact: true })).toBeInViewport()
    expect(await canvas.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
  }
  await page.getByRole('button', { name: '提交到 GitHub', exact: true }).click()
  await expect(page.getByRole('region', { name: '提交规划到 GitHub' })).toBeVisible()
  await expect.poll(() => canvas.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
  await page.getByLabel('搜索模块').fill('no-matching-module')
  await expect(page.getByText('没有匹配的模块', { exact: true })).toBeVisible()
  expect(await page.locator('.workspace > .empty').evaluate(element => Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThanOrEqual(1)
})

test('published topology automatically unfolds all dependencies without creating a local draft', async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: publishedPlan }))
  await page.goto('./')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await expect(page.locator('.react-flow__edge')).toHaveCount(publishedPlan.relationships.length)
  await expect(page.locator('.planner-node > .node-meta > strong')).toHaveCount(publishedPlan.modules.length)
  await expect(page.locator('.planner-node > strong')).toHaveCount(0)
  await expect(page.locator('.planner-node > .node-footer')).toHaveCount(publishedPlan.modules.length)
  await expect(page.locator('.planner-node .node-meta strong').first()).toHaveCSS('font-size', '18px')
  await expect(page.locator('.planner-node .node-meta .code').first()).toHaveCSS('font-size', '12px')
  await expect(page.locator('.react-flow__node[data-id="M01"] .node-meta')).toHaveAttribute('title', new RegExp(publishedPlan.modules.find(module => module.id === 'M01')!.name))
  const layerLegend = page.getByRole('group', { name: '架构层颜色图例', exact: true })
  await expect(layerLegend.locator('.layer-key')).toHaveCount(5)
  await expect(page.locator('.canvas-toolbar-row')).toHaveCount(1)
  expect(await page.locator('.edge-legend').evaluate(element => {
    const toggle = document.querySelector('.canvas-toolbar .check')!.getBoundingClientRect()
    const legend = element.getBoundingClientRect()
    return Math.abs((legend.top + legend.bottom) / 2 - (toggle.top + toggle.bottom) / 2) <= 1
  })).toBeTruthy()
  expect(await page.locator('.canvas-toolbar').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(65)
  expect(await layerLegend.evaluate(element => {
    const row = element.closest('.canvas-toolbar-row')!
    return row.contains(document.querySelector('input[type="checkbox"]')) && element.getBoundingClientRect().right <= row.getBoundingClientRect().right
  })).toBeTruthy()
  await expect(page.getByRole('alert')).toHaveCount(0)
  const readableNode = await page.locator('.react-flow__node[data-id="M01"]').boundingBox()
  expect(readableNode!.width).toBeGreaterThanOrEqual(187)
  await page.getByRole('button', { name: '适应全图', exact: true }).click()
  await expect.poll(() => page.locator('.react-flow__node').evaluateAll(elements => elements.every(element => {
    const node = element.getBoundingClientRect()
    const viewport = element.closest('.react-flow')!.getBoundingClientRect()
    return node.left >= viewport.left && node.right <= viewport.right && node.top >= viewport.top && node.bottom <= viewport.bottom
  }))).toBeTruthy()
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.canvas').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: '重新布局', exact: true }).click()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.screenshot({ path: '.impeccable/review/topology-mobile.png', animations: 'disabled' })
})

test('fresh business canvases stay spread out on phone, landscape and desktop without automatic whole-graph shrinking', async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: publishedPlan }))
  let geometry: { id: string | undefined; transform: string; width: number; height: number }[] | undefined
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('./')
    await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
    await page.locator('.canvas').scrollIntoViewIfNeeded()
    const node = page.locator('.react-flow__node[data-id="M01"]')
    await expect(node).toBeInViewport()
    expect((await node.boundingBox())!.width).toBeGreaterThanOrEqual(187)
    const current = await page.locator('.react-flow__node').evaluateAll(elements => elements.map(element => {
      const node = element as HTMLElement
      return { id: node.dataset.id, transform: node.style.transform, width: node.offsetWidth, height: node.offsetHeight }
    }).sort((a, b) => a.id!.localeCompare(b.id!)))
    if (geometry) expect(current).toEqual(geometry)
    else geometry = current
    await expect(page.locator('.react-flow__edge')).toHaveCount(publishedPlan.relationships.length)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await mkdir('.impeccable/review', { recursive: true })
    await page.screenshot({ path: `.impeccable/review/topology-readable-${viewport.width}.png`, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.canvas').scrollIntoViewIfNeeded()
  expect((await page.locator('.react-flow__node[data-id="M01"]').boundingBox())!.width).toBeGreaterThanOrEqual(187)
  await page.getByRole('button', { name: '重新布局', exact: true }).click()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  const original = await page.locator('.react-flow__viewport').getAttribute('style')
  const start = await page.locator('.react-flow__pane').evaluate(element => {
    const pane = element.getBoundingClientRect()
    for (let y = Math.max(0, pane.top) + 20; y < Math.min(window.innerHeight, pane.bottom) - 80; y += 30) {
      for (let x = pane.left + 20; x < pane.right - 100; x += 30) {
        if (document.elementFromPoint(x, y) === element) return { x, y }
      }
    }
    throw new Error('No visible blank canvas area available for panning')
  })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 85, start.y + 55, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style', original!)
  expect((await page.locator('.react-flow__node[data-id="M01"]').boundingBox())!.width).toBeGreaterThanOrEqual(187)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  await page.getByRole('button', { name: '适应全图', exact: true }).click()
  await expect.poll(() => page.locator('.react-flow__node').evaluateAll(elements => elements.every(element => {
    const box = element.getBoundingClientRect()
    const viewport = element.closest('.react-flow')!.getBoundingClientRect()
    return box.left >= viewport.left && box.right <= viewport.right && box.top >= viewport.top && box.bottom <= viewport.bottom
  }))).toBeTruthy()
})

test('selecting modules highlights direct upstream and downstream neighbors, handles feedback and dims only unrelated cards', async ({ page }) => {
  const plan = {
    ...seed,
    modules: seed.modules.filter(module => ['M01', 'M02', 'M03', 'M04', 'M05'].includes(module.id)),
    relationships: [
      { id: 'upstream', source: 'M01', target: 'M02' },
      { id: 'downstream', source: 'M02', target: 'M03' },
      { id: 'feedback-out', source: 'M02', target: 'M04' },
      { id: 'feedback-in', source: 'M04', target: 'M02' },
    ],
  }
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)
  const originalViewport = await page.locator('.react-flow__viewport').getAttribute('style')
  await node('M02').click()
  await expect(node('M02')).toHaveClass(/selected/)
  await expect(node('M02').locator('.planner-node')).toHaveCSS('opacity', '1')
  await expect(node('M01')).toHaveClass(/node-upstream/)
  await expect(node('M03')).toHaveClass(/node-downstream/)
  await expect(node('M04')).toHaveClass(/node-upstream/)
  await expect(node('M04')).toHaveClass(/node-downstream/)
  await expect(node('M04')).toHaveAttribute('aria-label', /上游与下游/)
  await expect(node('M01').locator('.planner-node')).toHaveCSS('box-shadow', /rgba\(22, 75, 135,/)
  await expect(node('M03').locator('.planner-node')).toHaveCSS('box-shadow', /rgba\(255, 229, 153,/)
  await expect(node('M04').locator('.planner-node')).toHaveCSS('box-shadow', /rgba\(22, 75, 135,.*rgba\(255, 229, 153,/)
  await expect(node('M05').locator('.planner-node')).toHaveCSS('opacity', '0.28')
  await expect(page.locator('.node-dimmed')).toHaveCount(1)
  await expect(page.locator('.react-flow__viewport')).toHaveAttribute('style', originalViewport!)
  await mkdir('.impeccable/review', { recursive: true })
  await page.screenshot({ path: '.impeccable/review/topology-focus.png', animations: 'disabled' })
  await node('M05').click()
  await expect(node('M05')).toHaveClass(/selected/)
  await expect(page.locator('.node-dimmed')).toHaveCount(4)
  await node('M02').focus()
  await page.keyboard.press('Enter')
  await expect(node('M02')).toHaveClass(/selected/)
  await expect(node('M03')).toHaveClass(/node-downstream/)
  await node('M05').click()
  await page.getByLabel('搜索模块').fill('M01')
  await expect(page.locator('.node-dimmed')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('canvas selection toggles off by repeat click, keyboard and blank canvas without hiding dependencies or changing data', async ({ page }) => {
  const plan = {
    ...seed,
    modules: seed.modules.filter(module => ['M01', 'M02', 'M03', 'M04'].includes(module.id)),
    relationships: [
      { id: 'one-two', source: 'M01', target: 'M02' },
      { id: 'two-three', source: 'M02', target: 'M03' },
    ],
  }
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  const node = page.locator('.react-flow__node[data-id="M02"]')
  const originalViewport = await page.locator('.react-flow__viewport').getAttribute('style')
  await node.click()
  await expect(node).toHaveClass(/selected/)
  await expect(page.locator('.node-dimmed')).toHaveCount(1)
  await page.getByRole('checkbox', { name: '全部连线', exact: true }).uncheck()
  await node.click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await expect(page.locator('.node-dimmed, .node-upstream, .node-downstream')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  for (const card of await page.locator('.planner-node').all()) await expect(card).toHaveCSS('opacity', '1')
  for (const edge of await page.locator('.react-flow__edge-path').all()) await expect(edge).toHaveCSS('opacity', '1')
  await expect(page.getByLabel('模块名称')).toHaveCount(0)
  await expect(page.locator('.inspector')).toContainText('再次点击取消选中')
  await expect(page.locator('.react-flow__viewport')).toHaveAttribute('style', originalViewport!)
  await node.click()
  await expect(node).toHaveClass(/selected/)
  await expect(page.getByLabel('模块名称')).toHaveValue(plan.modules.find(module => module.id === 'M02')!.name)
  await node.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(node).toHaveClass(/selected/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await node.click()
  await page.locator('.react-flow__pane').click({ position: { x: 8, y: 8 } })
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.canvas').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: '重新布局', exact: true }).click()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '适应全图', exact: true }).click()
  await node.click()
  await expect(node).toHaveClass(/selected/)
  await node.click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
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
  await page.getByRole('button', { name: '恢复本地草稿', exact: true }).click()
  await page.getByRole('button', { name: '分工清单' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'M01' })).toContainText('项目建模')
})

test('canvas layout, relationships and deletion persist in the exported plan', async ({ page }) => {
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: { ...seed, modules: seed.modules.filter(module => ['M01', 'M02'].includes(module.id)) } }))
  await page.goto('./')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  const node = page.locator('.react-flow__node[data-id="M01"]')
  await expect.poll(async () => (await node.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(180)
  const box = await node.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(180)
  await page.mouse.move(box!.x + 60, box!.y + 35)
  await page.mouse.down()
  await page.mouse.move(box!.x + 120, box!.y + 65, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).not.toBeNull()
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

test('dependency connectors point from the upstream provider to the downstream module, including feedback cycles', async ({ page }) => {
  const plan = {
    ...seed,
    relationships: [
      { id: 'sso-events', source: 'M17', target: 'M11' },
      { id: 'events-assessment', source: 'M11', target: 'M02' },
      { id: 'assessment-events', source: 'M02', target: 'M11' },
    ],
  }
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  for (const edge of plan.relationships) {
    const connector = page.getByLabel(`Edge from ${edge.source} to ${edge.target}`, { exact: true })
    await expect(connector.locator('.react-flow__edge-path')).toHaveAttribute('marker-end', /^url\(.+\)$/)
  }
})

test('module dependency navigation distinguishes upstream and downstream without changing the plan', async ({ page }) => {
  const plan = {
    ...seed,
    relationships: [
      { id: 'sso-events', source: 'M17', target: 'M11' },
      { id: 'events-assessment', source: 'M11', target: 'M02' },
      { id: 'assessment-events', source: 'M02', target: 'M11' },
    ],
  }
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await page.getByRole('button', { name: '分工清单', exact: true }).click()
  await page.getByRole('button', { name: 'M11 学习数据与事件', exact: true }).click()
  const dependencies = page.getByRole('region', { name: '模块依赖', exact: true })
  await expect(dependencies.getByRole('button', { name: '查看上游模块 M17', exact: true })).toBeVisible()
  await expect(dependencies.getByRole('button', { name: '查看上游模块 M02', exact: true })).toBeVisible()
  await expect(dependencies.getByRole('button', { name: '查看下游模块 M02', exact: true })).toBeVisible()
  await expect(dependencies.getByRole('button')).toHaveCount(3)
  await page.getByLabel('Owner 筛选').selectOption('unassigned')
  await dependencies.getByRole('button', { name: '查看上游模块 M17', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('用户与身份服务')
  await expect(page.getByLabel('Owner 筛选')).toHaveValue('')
  await expect(dependencies.getByRole('button', { name: '查看下游模块 M11', exact: true })).toBeVisible()
  await dependencies.getByRole('button', { name: '查看下游模块 M11', exact: true }).click()
  await expect(page.getByLabel('模块名称')).toHaveValue('学习数据与事件')
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
})

test('dense dependency plans show all edges by default, color directions and support optional focus without changing exports', async ({ page }) => {
  const relationships = Array.from({ length: 15 }, (_, index) => ({
    id: `dependency-${index}`, source: `M${String(index + 1).padStart(2, '0')}`, target: `M${String(index + 2).padStart(2, '0')}`,
  }))
  const plan = { ...seed, relationships }
  await page.route('**/src/seed-plan.json', route => route.fulfill({ json: plan }))
  await page.goto('./')
  await expect(page.locator('.react-flow__node')).toHaveCount(24)
  await expect(page.locator('.react-flow__edge')).toHaveCount(15)
  await expect(page.getByLabel('显示的依赖数', { exact: true })).toHaveText('15/15')
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  const allEdges = page.getByRole('checkbox', { name: '全部连线', exact: true })
  await expect(allEdges).toBeChecked()
  expect(await page.evaluate(() => {
    const toolbar = document.querySelector('.canvas-toolbar')!.getBoundingClientRect()
    return [...document.querySelectorAll('.planner-node')].every(node => {
      const box = node.getBoundingClientRect()
      return box.right <= toolbar.left || box.left >= toolbar.right || box.bottom <= toolbar.top || box.top >= toolbar.bottom
    })
  })).toBe(true)
  await allEdges.uncheck()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.react-flow__node[data-id="M02"]').click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await expect(page.getByLabel('显示的依赖数', { exact: true })).toHaveText('2/15')
  const upstream = page.locator('.dependency-upstream .react-flow__edge-path')
  const downstream = page.locator('.dependency-downstream .react-flow__edge-path')
  await expect(upstream).toHaveCSS('stroke', 'rgb(33, 103, 173)')
  await expect(downstream).toHaveCSS('stroke', 'rgb(163, 77, 18)')
  await allEdges.check()
  await expect(page.locator('.react-flow__edge')).toHaveCount(15)
  await page.getByRole('button', { name: '重新布局', exact: true }).click()
  await expect(page.getByRole('button', { name: '重新布局', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => localStorage.getItem('architecture-planner.plan.v1'))).toBeNull()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出规划', exact: true }).click()
  const stream = await (await pending).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).relationships).toEqual(relationships)
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
  await expect(page.locator('.wordmark')).toHaveAttribute('title', 'Imported plan')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('architecture-planner.plan.v1')!).name)).toBe('Imported plan')
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
