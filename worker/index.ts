import seed from '../src/seed-plan.json'
import { MAX_PLAN_BYTES, validatePlan } from '../src/plan.ts'
import type { Plan } from '../src/plan.ts'

type Env = { DB: D1Database; EDITOR_TOKEN: string; ALLOWED_ORIGIN: string }
type StoredPlan = { revision: number; document: string | null }
const baseline = validatePlan(seed)

class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

async function readJSON(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new InputError('Content-Type must be application/json', 415)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new InputError('A JSON body is required')
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  let bytes = 0
  let text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_PLAN_BYTES) throw new InputError('Request exceeds 512 KiB', 413)
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(text)
}

async function authorized(request: Request, secret: string) {
  const bearer = /^Bearer (\S{32,512})$/i.exec(request.headers.get('authorization') ?? '')
  if (!bearer) return false
  const encoder = new TextEncoder()
  const [provided, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(bearer[1])),
    crypto.subtle.digest('SHA-256', encoder.encode(secret)),
  ])
  return crypto.subtle.timingSafeEqual(provided, expected)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const baseHeaders: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' }
    const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      Response.json(body, { status, headers: { ...baseHeaders, ...headers } })
    if (path === '/health' && request.method === 'GET') return reply({ status: 'ok' })
    if (path !== '/api/plan') return reply({ error: 'Not found' }, 404)

    let allowedOrigin: string
    try {
      allowedOrigin = new URL(env.ALLOWED_ORIGIN).origin
      if (allowedOrigin !== env.ALLOWED_ORIGIN || !env.DB
        || !/^\S{32,512}$/.test(env.EDITOR_TOKEN ?? '')) throw new Error('Invalid API configuration')
    } catch {
      console.error('Planner API configuration is missing or invalid')
      return reply({ error: 'API is not configured' }, 503)
    }
    const origin = request.headers.get('origin')
    if (origin && origin !== allowedOrigin) return reply({ error: 'Origin is not allowed' }, 403)
    if (origin) baseHeaders['Access-Control-Allow-Origin'] = allowedOrigin
    if (request.method === 'OPTIONS') {
      if (!origin) return reply({ error: 'Preflight requires an allowed Origin' }, 403)
      return new Response(null, { status: 204, headers: {
        ...baseHeaders, 'Access-Control-Allow-Methods': 'GET, PUT',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600',
      } })
    }
    if (!await authorized(request, env.EDITOR_TOKEN)) {
      return reply({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' })
    }
    if (request.method !== 'GET' && request.method !== 'PUT') return reply({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT, OPTIONS' })

    if (request.method === 'GET') {
      try {
        const stored = await env.DB.prepare('SELECT revision, document FROM plans WHERE id = 1').first<StoredPlan>()
        if (!stored || !Number.isSafeInteger(stored.revision) || stored.revision < 0) throw new Error('Invalid stored revision')
        return reply({ plan: stored.document === null ? baseline : validatePlan(JSON.parse(stored.document)), revision: stored.revision })
      } catch (error) {
        console.error('Planner storage read failed', error instanceof Error ? error.name : 'unknown error')
        return reply({ error: 'Plan storage is unavailable' }, 503)
      }
    }

    let plan: Plan
    let revision: number
    try {
      const body = await readJSON(request)
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2
        || !('plan' in body) || !('revision' in body) || typeof body.revision !== 'number'
        || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER) {
        throw new InputError('Expected { plan, revision } with a nonnegative integer revision')
      }
      plan = validatePlan(body.plan)
      revision = body.revision
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : 'Invalid request' }, error instanceof InputError ? error.status : 400)
    }
    try {
      const result = await env.DB.prepare('UPDATE plans SET document = ?, revision = revision + 1 WHERE id = 1 AND revision = ?')
        .bind(JSON.stringify(plan), revision).run()
      if (result.meta.changes !== 1) return reply({ error: 'Revision conflict; reload before merging local changes' }, 409)
      return reply({ plan, revision: revision + 1 })
    } catch (error) {
      console.error('Planner storage write failed', error instanceof Error ? error.name : 'unknown error')
      return reply({ error: 'Plan storage is unavailable' }, 503)
    }
  },
}
