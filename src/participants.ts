import { validatePlan } from './plan.ts'
import type { Person, Plan } from './plan.ts'

const githubLoginPattern = /^[a-z\d]+(?:-[a-z\d]+)*$/i

export function githubProfileUrl(person: Person, configuredParticipants: unknown = []): string | null {
  const configured = Array.isArray(configuredParticipants) && configuredParticipants.some((value: unknown) =>
    typeof value === 'object' && value !== null && 'login' in value && typeof value.login === 'string'
    && value.login.toLowerCase() === person.name.toLowerCase())
  if ((!/^github-[1-9]\d*$/.test(person.id) && !configured) || person.name.length > 39 || !githubLoginPattern.test(person.name)) return null
  return `https://github.com/${person.name}`
}

export function mergeGitHubParticipants(plan: Plan, input: unknown): Plan {
  if (!Array.isArray(input) || input.length > 200) throw new Error('participants: expected at most 200 GitHub accounts')
  const people = plan.people.map(person => ({ ...person }))
  const ids = new Set<number>()
  const names = new Set<string>()
  for (const value of input) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => key !== 'id' && key !== 'login')
      || !Number.isSafeInteger(value.id) || value.id <= 0
      || typeof value.login !== 'string' || value.login.length > 39
      || !githubLoginPattern.test(value.login)) throw new Error('participants: invalid GitHub account')
    const name = value.login.toLowerCase()
    if (ids.has(value.id) || names.has(name)) throw new Error('participants: duplicate GitHub account')
    ids.add(value.id)
    names.add(name)
    const id = `github-${value.id}`
    const byId = people.find(person => person.id === id)
    const byName = people.find(person => person.name.toLowerCase() === name)
    if (byId && byName && byId !== byName) throw new Error('participants: identity conflict; existing assignments were not changed')
    if (byId) byId.name = value.login
    else if (!byName) people.push({ id, name: value.login })
  }
  return validatePlan({ ...plan, people })
}
