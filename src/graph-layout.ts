import type { Module, Position, Relationship } from './plan.ts'

export type NodeSize = { width: number; height: number }
export type GraphLayout = {
  positions: Record<string, Position>
  routes: Record<string, Position[]>
}

export async function layoutGraph(modules: Pick<Module, 'id'>[], relationships: Relationship[], sizes: Record<string, NodeSize>): Promise<GraphLayout> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const graph = await new ELK().layout({
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
    },
    children: modules.map(module => {
      const { width, height } = sizes[module.id] ?? { width: 250, height: 145 }
      return {
        id: module.id, width, height,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: [
          { id: `${module.id}-in`, x: 0, y: height / 2, width: 0, height: 0 },
          { id: `${module.id}-out`, x: width, y: height / 2, width: 0, height: 0 },
        ],
      }
    }),
    edges: relationships.map(edge => ({
      id: edge.id, sources: [`${edge.source}-out`], targets: [`${edge.target}-in`],
    })),
  })
  const positions: GraphLayout['positions'] = {}
  const routes: GraphLayout['routes'] = {}
  for (const node of graph.children ?? []) {
    if (node.x === undefined || node.y === undefined) throw new Error(`模块 ${node.id} 缺少布局坐标`)
    positions[node.id] = { x: node.x, y: node.y }
  }
  for (const edge of graph.edges ?? []) {
    const section = edge.sections?.[0]
    if (!section) throw new Error(`依赖 ${edge.id} 缺少连线路径`)
    routes[edge.id] = [section.startPoint, ...section.bendPoints ?? [], section.endPoint]
  }
  return { positions, routes }
}
