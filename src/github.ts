import { validatePlan } from './plan.ts'
import type { Plan } from './plan.ts'

const repository = 'THU-MEM/ArchitecturePlanner'
const website = `https://github.com/${repository}`
const file = 'src/seed-plan.json'

export class SubmissionError extends Error {
  readonly branchUrl?: string

  constructor(message: string, branchUrl?: string) {
    super(message)
    this.branchUrl = branchUrl
  }
}

export async function submitPlanPullRequest(plan: Plan, token: string, description: string): Promise<string> {
  const checked = validatePlan(plan)
  const title = description.trim()
  if (!title || title.length > 120 || /[\r\n]/.test(title)) throw new Error('请填写不超过 120 个字符的单行修改说明')
  if (!/^\S{1,512}$/.test(token.trim())) throw new Error('请输入有效的 GitHub Token')
  const content = btoa(Array.from(new TextEncoder().encode(`${JSON.stringify(checked, null, 2)}\n`), byte => String.fromCharCode(byte)).join(''))

  async function request(path: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const help = response.status === 401 ? 'Token 无效或已过期'
        : response.status === 403 ? '请检查仓库写权限、Token 授权、组织审批或 API 额度'
          : '请到 GitHub 检查请求与仓库状态'
      throw new Error(`GitHub HTTP ${response.status}：${help}`)
    }
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('GitHub 返回了无效的数据结构')
    return result as Record<string, unknown>
  }

  let branchUrl: string | undefined
  let stage = '读取仓库'
  try {
    const reference = await request('/git/ref/heads/main')
    if (!reference.object || typeof reference.object !== 'object' || !('sha' in reference.object)
      || typeof reference.object.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(reference.object.sha)) throw new Error('GitHub 返回了无效的分支信息')
    const commit = reference.object.sha
    const current = await request(`/contents/${file}?ref=${commit}`)
    if (current.type !== 'file' || typeof current.sha !== 'string'
      || !/^[a-f0-9]{40,64}$/.test(current.sha)) throw new Error('GitHub 返回了无效的文件信息')
    const branch = `planner/${crypto.randomUUID()}`
    branchUrl = `${website}/compare/main...${branch}?expand=1`
    stage = '创建提案分支'
    await request('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: commit })
    stage = '提交规划 JSON'
    await request(`/contents/${file}`, 'PUT', {
      message: `plan: ${title}`,
      content,
      sha: current.sha,
      branch,
    })
    stage = '创建 PR'
    const pull = await request('/pulls', 'POST', {
      title: `plan: ${title}`,
      head: branch,
      base: 'main',
      body: `## 修改\n${title}\n\n## 文件与必要性\n- \`${file}\`：保存本次架构规划与分工草稿。\n\n由维护者审核差异、解决冲突；合入后由 GitHub Pages 自动发布。本 PR 不直接发布页面。`,
    })
    if (typeof pull.html_url !== 'string'
      || !/^https:\/\/github\.com\/THU-MEM\/ArchitecturePlanner\/pull\/[1-9]\d*$/.test(pull.html_url)) throw new Error('GitHub 未返回有效的 PR 链接')
    return pull.html_url
  } catch (error) {
    throw new SubmissionError(`${stage}失败：${error instanceof Error ? error.message : String(error)}。本地草稿仍保留。${branchUrl ? '分支或 PR 可能已创建，请先检查再重试。' : ''}`, branchUrl)
  }
}
