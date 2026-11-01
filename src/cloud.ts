import { validatePlan } from './plan.ts'
import type { Plan } from './plan.ts'

export async function cloudRequest(base: string, token: string, save?: { plan: Plan; revision: number }): Promise<{ plan: Plan; revision: number }> {
  const url = new URL(base)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.search || url.hash) throw new Error('请输入不带凭证或查询参数的 HTTPS API 地址')
  if (!token.trim()) throw new Error('需要编辑 token')
  if (save && (!Number.isSafeInteger(save.revision) || save.revision < 0)) throw new Error('请先读取共享规划的版本')
  const response = await fetch(new URL('/api/plan', url), {
    method: save ? 'PUT' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(save ? { 'Content-Type': 'application/json' } : {}) },
    ...(save ? { body: JSON.stringify(save) } : {}),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  })
  if (response.status === 409) throw new Error('共享版本已变化，保存未成功。请导出草稿，读取最新版本后再合并')
  if (!response.ok) throw new Error(`HTTP ${response.status}，请检查地址、授权或服务日志`)
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('plan' in result) || !('revision' in result)
    || typeof result.revision !== 'number' || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('API 返回了无效的数据结构')
  return { plan: validatePlan(result.plan), revision: result.revision }
}
