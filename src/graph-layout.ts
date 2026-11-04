import type { Module, Position, Relationship } from './plan.ts'
import type { ElkNode } from 'elkjs/lib/elk-api.js'

export type NodeSize = { width: number; height: number }
export type GraphLayout = {
  positions: Record<string, Position>
  routes: Record<string, Position[]>
  groups: Record<string, Position & NodeSize>
}
export type GraphGroup = { id: string; members: string[] }

export async function layoutGraph(modules: Pick<Module, 'id'>[], relationships: Relationship[], sizes: Record<string, NodeSize>, groups: GraphGroup[] = []): Promise<GraphLayout> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const children: ElkNode[] = modules.map(module => {
    const { width, height } = sizes[module.id] ?? { width: 250, height: 145 }
    return {
      id: module.id, width, height,
      layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
      ports: [
        { id: `${module.id}-in`, x: 0, y: height / 2, width: 0, height: 0 },
        { id: `${module.id}-out`, x: width, y: height / 2, width: 0, height: 0 },
      ],
    }
  })
  const groupedIds = new Set(groups.flatMap(group => group.members))
  const input: ElkNode = {
    id: 'architecture',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '65',
      'elk.layered.spacing.nodeNodeBetweenLayers': '130',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.spacing.edgeNode': '25',
      'elk.spacing.edgeEdge': '16',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.separateConnectedComponents': 'true',
      'elk.randomSeed': '1',
      'elk.padding': '[top=35,left=35,bottom=35,right=35]',
      ...(groups.length ? { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' } : {}),
    },
    children: [
      ...children.filter(node => !groupedIds.has(node.id)),
      ...groups.filter(group => children.some(node => group.members.includes(node.id))).map(group => ({
        id: group.id,
        layoutOptions: { 'elk.padding': '[top=80,left=40,bottom=40,right=40]' },
        children: children.filter(node => group.members.includes(node.id)),
      })),
    ],
    edges: relationships.map(edge => ({
      id: edge.id, sources: [`${edge.source}-out`], targets: [`${edge.target}-in`],
    })),
  }
  const graph = await new ELK().layout(input)
  const positions: GraphLayout['positions'] = {}
  const routes: GraphLayout['routes'] = {}
  const groupBounds: GraphLayout['groups'] = {}
  function collect(container: ElkNode, offset: Position) {
    for (const node of container.children ?? []) {
      if (node.x === undefined || node.y === undefined) throw new Error(`模块 ${node.id} 缺少布局坐标`)
      const position = { x: offset.x + node.x, y: offset.y + node.y }
      if (node.children) {
        if (node.width === undefined || node.height === undefined) throw new Error(`域 ${node.id} 缺少布局尺寸`)
        groupBounds[node.id] = { ...position, width: node.width, height: node.height }
        collect(node, position)
      } else positions[node.id] = position
    }
    for (const edge of container.edges ?? []) {
      const section = edge.sections?.[0]
      if (!section || edge.sections?.length !== 1) throw new Error(`依赖 ${edge.id} 缺少完整连线路径`)
      routes[edge.id] = [section.startPoint, ...section.bendPoints ?? [], section.endPoint]
        .map(point => ({ x: point.x + offset.x, y: point.y + offset.y }))
    }
  }
  collect(graph, { x: 0, y: 0 })
  return { positions, routes, groups: groupBounds }
}
