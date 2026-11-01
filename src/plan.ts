export type Owner = { personId: string; role: 'primary' | 'secondary' }
export type Person = { id: string; name: string }
export type Position = { x: number; y: number }
export type Module = {
  id: string
  name: string
  summary: string
  detail: string
  layer: string
  components: string[]
  owners: Owner[]
  status: 'planned' | 'active' | 'done'
  position: Position
}
export type Component = { id: string; name: string; detail: string; stack: string; owners?: Owner[] }
export type Relationship = { id: string; source: string; target: string }
export type Plan = {
  schemaVersion: 1
  name: string
  people: Person[]
  modules: Module[]
  components: Component[]
  relationships: Relationship[]
}

export const MAX_PLAN_BYTES = 512 * 1024
export const layers: Record<string, string> = {
  frontend: '前端与交互',
  learning: '教学业务',
  knowledge: '知识工程',
  platform: '平台服务',
  governance: '治理与协同',
}
export const statuses = { planned: '待开展', active: '进行中', done: '已完成' }

function object(value: unknown, keys: string[], label: string, optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`)
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => !keys.includes(key) && !optional.includes(key))) throw new Error(`${label}: unexpected field`)
  if (keys.some(key => !(key in record))) throw new Error(`${label}: missing field`)
  return record
}

function text(value: unknown, max: number, label: string, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`${label}: invalid text (maximum ${max} characters)`)
  }
  return required ? value.trim() : value
}

function id(value: unknown, label: string): string {
  const result = text(value, 64, label, true)
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(result)) throw new Error(`${label}: invalid ID`)
  return result
}

function list(value: unknown, max: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label}: invalid list`)
  return value
}

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label}: duplicate entry`)
}

function readOwners(value: unknown, people: Person[]): Owner[] {
  const owners: Owner[] = list(value, 32, 'owners').map(value => {
    const owner = object(value, ['personId', 'role'], 'owner')
    if (owner.role !== 'primary' && owner.role !== 'secondary') throw new Error('owner: invalid role')
    const personId = id(owner.personId, 'owner')
    if (!people.some(person => person.id === personId)) throw new Error('owner: unknown person')
    return { personId, role: owner.role }
  })
  unique(owners.map(owner => owner.personId), 'owners')
  if (owners.filter(owner => owner.role === 'primary').length > 1) throw new Error('owners: only one primary owner is allowed')
  return owners
}

export function validatePlan(input: unknown): Plan {
  const root = object(input, ['schemaVersion', 'name', 'people', 'modules', 'components', 'relationships'], 'plan')
  if (root.schemaVersion !== 1) throw new Error('plan: unsupported schemaVersion')
  const people = list(root.people, 200, 'people').map(value => {
    const person = object(value, ['id', 'name'], 'person')
    return { id: id(person.id, 'person'), name: text(person.name, 80, 'person name', true) }
  })
  unique(people.map(person => person.id), 'people')
  unique(people.map(person => person.name.toLocaleLowerCase()), 'people names')
  const components = list(root.components, 200, 'components').map(value => {
    const component = object(value, ['id', 'name', 'detail', 'stack'], 'component', ['owners'])
    return {
      id: id(component.id, 'component'), name: text(component.name, 120, 'component name', true),
      detail: text(component.detail, 5000, 'component detail'), stack: text(component.stack, 500, 'component stack'),
      ...('owners' in component ? { owners: readOwners(component.owners, people) } : {}),
    }
  })
  unique(components.map(component => component.id), 'components')
  const modules = list(root.modules, 200, 'modules').map<Module>(value => {
    const module = object(value, ['id', 'name', 'summary', 'detail', 'layer', 'components', 'owners', 'status', 'position'], 'module')
    const owners = readOwners(module.owners, people)
    const references = list(module.components, 200, 'module components').map(value => id(value, 'component'))
    unique(references, 'module components')
    if (references.some(ref => !components.some(component => component.id === ref))) throw new Error('component: unknown reference')
    const position = object(module.position, ['x', 'y'], 'position')
    if (typeof position.x !== 'number' || typeof position.y !== 'number'
      || !Number.isFinite(position.x) || !Number.isFinite(position.y)
      || Math.abs(position.x) > 1000000 || Math.abs(position.y) > 1000000) throw new Error('position: invalid coordinates')
    if (module.status !== 'planned' && module.status !== 'active' && module.status !== 'done') throw new Error('module status: invalid value')
    return {
      id: id(module.id, 'module'), name: text(module.name, 120, 'module name', true),
      summary: text(module.summary, 500, 'module summary'), detail: text(module.detail, 5000, 'module detail'),
      layer: text(module.layer, 64, 'module layer', true), components: references, owners, status: module.status,
      position: { x: position.x, y: position.y },
    }
  })
  unique(modules.map(module => module.id), 'modules')
  const relationships = list(root.relationships, 2000, 'relationships').map(value => {
    const relationship = object(value, ['id', 'source', 'target'], 'relationship')
    const source = id(relationship.source, 'relationship source')
    const target = id(relationship.target, 'relationship target')
    if (source === target || !modules.some(module => module.id === source) || !modules.some(module => module.id === target)) {
      throw new Error('relationship: invalid endpoints')
    }
    return { id: id(relationship.id, 'relationship'), source, target }
  })
  unique(relationships.map(edge => edge.id), 'relationships')
  unique(relationships.map(edge => `${edge.source}:${edge.target}`), 'relationships')
  const plan: Plan = { schemaVersion: 1, name: text(root.name, 120, 'plan name', true), people, modules, components, relationships }
  if (new TextEncoder().encode(JSON.stringify(plan)).length > MAX_PLAN_BYTES) throw new Error('plan: document exceeds 512 KiB')
  return plan
}

export function updateModule(plan: Plan, moduleId: string, patch: Partial<Omit<Module, 'id'>>): Plan {
  if (!plan.modules.some(module => module.id === moduleId)) throw new Error('module: not found')
  return validatePlan({ ...plan, modules: plan.modules.map(module => module.id === moduleId ? { ...module, ...patch } : module) })
}

export function assignOwners(plan: Plan, moduleId: string, primary: string, secondary: string[]): Plan {
  const owners: Owner[] = [
    ...(primary ? [{ personId: primary, role: 'primary' as const }] : []),
    ...secondary.map(personId => ({ personId, role: 'secondary' as const })),
  ]
  return updateModule(plan, moduleId, { owners })
}

export function addRelationship(plan: Plan, source: string, target: string): Plan {
  if (plan.relationships.some(edge => edge.source === source && edge.target === target)) return plan
  return validatePlan({ ...plan, relationships: [...plan.relationships, { id: `edge-${crypto.randomUUID()}`, source, target }] })
}

export function addPerson(plan: Plan, name: string): Plan {
  if (plan.people.some(person => person.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) throw new Error('person: already exists')
  return validatePlan({ ...plan, people: [...plan.people, { id: `person-${crypto.randomUUID()}`, name }] })
}

export function assignComponentOwners(plan: Plan, componentId: string, primary: string, secondary: string[]): Plan {
  if (!plan.components.some(component => component.id === componentId)) throw new Error('component: not found')
  const owners: Owner[] = [
    ...(primary ? [{ personId: primary, role: 'primary' as const }] : []),
    ...secondary.map(personId => ({ personId, role: 'secondary' as const })),
  ]
  return validatePlan({ ...plan, components: plan.components.map(component => component.id === componentId ? { ...component, owners } : component) })
}
