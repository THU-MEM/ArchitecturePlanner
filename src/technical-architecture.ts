import { currentFlows, projectFacts } from './current-architecture.ts'
import type { ProjectFact } from './current-architecture.ts'

export type RuntimeState = 'ready' | 'blocked' | 'not-observed' | 'source' | 'planned'
export const runtimeStates: Record<RuntimeState, string> = {
  ready: '现场已运行',
  blocked: '部署未就绪',
  'not-observed': '集群未见',
  source: '仅源码 / 模板',
  planned: '待接入',
}
export type TechnicalFact = ProjectFact & { runtime: RuntimeState; observation: string }
export type TechnicalFlow = {
  id: string; source: string; target: string; label: string; detail: string
  evidence: 'observed' | 'source' | 'planned'
}

export const runtimeSnapshot = {
  inspectedAt: '2026-11-02 22:08 UTC+08:00',
  nodes: 1, pods: 19, running: 19, pending: 0,
  method: '经 SSH 只读核对 workload、Pod、Service、EndpointSlice、ApisixRoute、PVC/PV、StorageClass 与指标 API。数据库配置仅在远端匹配目标，不输出凭据；只读查询连接数，不读取业务数据，未执行部署或重启。',
}
const runtimeSource = [{ label: 'SSH 只读现场核对 · 2026-11-02（公开脱敏摘要，不是实时监控）' }]
const manifestSource = [{ label: 'AI-MEM server/deploy 与 server/services 源码及部署说明（仅职责摘要）' }]

const observations: Partial<Record<string, Pick<TechnicalFact, 'runtime' | 'observation'>>> = {
  'sso-identity': { runtime: 'ready', observation: 'sso-datacenter：Keycloak Deployment 1/1，Service 8080，1 个就绪端点；已有 APISIX 身份入口。仅核对资源就绪，未验收登录流程。' },
  'mem-gateway': { runtime: 'ready', observation: 'mem-ai：Deployment 1/1，Pod Running 且容器就绪，Service 3000 有 1 个就绪端点；APISIX 路由指向此 Service。SQL_DSN 已采用 PostgreSQL，数据库侧可见 1 个连接；未验收真实模型推理请求。' },
  'sso-console': { runtime: 'not-observed', observation: '本次集群清单中没有 console workload。React 控制台与部署生成器已有，不能据此认定已上线。' },
  'sso-hub': { runtime: 'not-observed', observation: '本次集群清单中没有 hub-api workload。部署生成器定义该服务及其 PostgreSQL、Redis、MinIO 依赖。' },
  'sso-events': { runtime: 'not-observed', observation: '本次集群清单中没有 event-ingest workload；Redis 和 ClickHouse 也未出现。事件链路为源码能力，不是现场已打通的链路。' },
  'mem-web': { runtime: 'ready', observation: '控制台随 MEM-AI 应用提供，不是独立 Pod；共享网关 Deployment 1/1 和就绪 Service 端点。未单独验收浏览器登录与管理操作。' },
  'mem-data': { runtime: 'source', observation: '这是账户、渠道、额度与日志的逻辑职责卡，不是独立 Pod。现场已核实网关接入 PostgreSQL；实际数据库与持久卷关系见「网关 PostgreSQL」和「PostgreSQL 共享实例」。未验收历史数据迁移。' },
}

function fact(id: string, name: string, project: string, stack: string, runtime: RuntimeState, detail: string, observation: string, components: string[] = []): TechnicalFact {
  return {
    id, name, project, stack, runtime, detail, observation, components, modules: [],
    state: 'implemented', position: { x: 0, y: 0 },
    sources: runtime === 'ready' || runtime === 'blocked' ? runtimeSource : manifestSource,
  }
}

export const technicalFacts: TechnicalFact[] = [
  ...projectFacts.map(item => ({
    ...item, runtime: item.state === 'planned' ? 'planned' as const : 'source' as const,
    observation: item.state === 'planned' ? '平台接入规划，尚未完成联调。' : '此卡描述源码能力或逻辑组件，不代表独立运行的 Pod，也不代表生产集成已验收。',
    sources: observations[item.id] ? [...item.sources, ...runtimeSource] : item.sources,
    ...observations[item.id],
  })),
  fact('kubernetes', 'Kubernetes 单节点', '基础设施', 'Kubernetes · containerd', 'ready',
    '单节点集群承载业务与基础组件；控制平面包括 API Server、Scheduler、Controller Manager 与 kube-proxy，不具备多节点高可用。',
    '实际核对 1 个节点、19 个 Pod，全部 Running 且容器就绪，0 Pending；运行时 containerd。Running 不等于业务链路验收。', ['kubernetes']),
  fact('apisix', 'APISIX 入口网关', '入口', 'Apache APISIX · HTTP/TLS', 'ready',
    '集群入口由 APISIX 处理；ApisixRoute 指向 Keycloak 与 MEM-AI 的 Service。路由存在不保证上游可用。',
    'Deployment 1/1；gateway Service 80/443；已见身份入口与 MEM-AI preview 路由。', ['api-gateway']),
  fact('ingress-controller', 'APISIX Ingress Controller', '入口', 'Controller · ADC', 'ready',
    '监听 Kubernetes 路由资源，将入口配置同步到 APISIX；属于控制面，不承载业务请求。',
    'Deployment 1/1；manager 与 adc-server 两个容器均就绪。', ['kubernetes']),
  fact('apisix-etcd', 'APISIX 配置存储', '入口', 'etcd · StatefulSet', 'ready',
    'etcd 保存网关配置，独立于应用数据与 Kubernetes API 资源。',
    'StatefulSet 1/1；1 个就绪端点；5Gi local-path PVC Bound。'),
  fact('cert-manager', '证书管理', '入口', 'cert-manager · TLS', 'ready',
    '负责证书资源的控制、注入与 webhook；组件就绪不代表所有公网域名的证书均已验收。',
    'cert-manager 命名空间：controller、cainjector、webhook 各 1/1，共 3 个 Pod 就绪；当前 Certificate 资源为 0，不能认定业务证书已由它签发。'),
  fact('calico', '集群网络', '基础设施', 'Calico · CNI', 'ready',
    '提供 Pod 网络；与 kube-proxy 的 Service 转发共同支撑服务通信。',
    'kube-system：calico-node DaemonSet 1/1；calico-kube-controllers Deployment 1/1，均 Running 且容器就绪。', ['kubernetes']),
  fact('coredns', '服务发现', '基础设施', 'CoreDNS · DNS', 'ready',
    '为集群内 Service 提供 DNS 解析，不是外部域名托管服务。',
    'kube-system：coredns Deployment 2/2；kube-dns Service 有 2 个就绪端点。'),
  fact('metrics', '资源指标', '基础设施', 'metrics-server', 'ready',
    '提供 Kubernetes 资源指标；不能据此认定已有 Prometheus、Grafana、日志与全链路追踪体系。',
    'kube-system：metrics-server Deployment 1/1，Service 有 1 个就绪端点；metrics.k8s.io APIService Available=True。', ['kubernetes']),
  fact('local-storage', '本地持久卷', '基础设施', 'local-path · PVC', 'ready',
    'local-path-provisioner 为单节点应用提供本地磁盘卷；已核实 PV 使用节点本地路径并带节点亲和性，不是跨节点复制，也不证明已有备份。',
    'provisioner 1/1；etcd 5Gi、PostgreSQL 20Gi、MEM-AI 1Gi 三个 PVC 均 Bound，并匹配本地 PV。'),
  fact('sso-postgres', 'PostgreSQL 共享实例', '共享数据', 'PostgreSQL · pgvector', 'ready',
    '同一 PostgreSQL 实例承载 Keycloak 与 MEM-AI，两者使用不同逻辑库和数据库用户名；不是两套 PostgreSQL Pod。未审计 SQL 授权或验收 pgvector 业务。',
    'sso-datacenter：postgres Deployment 1/1，Service 5432 有 1 个就绪端点；挂载 postgres-data 20Gi PVC 到 /var/lib/postgresql/data，Bound 至 local-path 本地 PV。', ['postgres', 'vector-index']),
  fact('mem-postgres', '网关 PostgreSQL', 'MEM-AI 逻辑库', 'PostgreSQL · SQL', 'ready',
    'MEM-AI 弃用 SQLite，现已接入 PostgreSQL。这是网关逻辑数据库，位于「PostgreSQL 共享实例」，不是新建的独立实例或第二块 20Gi 卷；与身份服务使用不同库及数据库用户名。',
    'SQL_DSN 的 PostgreSQL 协议和目标 Service 已匹配 sso-datacenter/postgres；数据库侧可见 1 个该逻辑库连接。未见 SQLITE_PATH 配置，未验收历史数据迁移或备份恢复。', ['postgres']),
  fact('mem-files', '网关应用数据卷', 'MEM-AI 卷', 'PVC · /data · 1Gi', 'ready',
    '网关 Pod 仍挂载 /data 应用数据目录；这块 1Gi 卷不是当前 PostgreSQL 主数据目录，不应因弃用 SQLite 就从部署图中删除。',
    'mem-ai Deployment 挂载 mem-ai-data 到 /data；1Gi PVC Bound 至 local-path 本地 PV。未读取卷内文件。'),
  fact('sso-redis', '缓存与事件 Stream', 'SSO 数据', 'Redis · Streams', 'not-observed',
    'SSO 部署生成器定义 Redis，供业务缓存、限流与事件流使用。',
    '本次集群 workload / Service 清单未见 Redis；仅有模板不算部署。', ['redis-stream']),
  fact('sso-minio', '资产对象存储', 'SSO 数据', 'MinIO · S3', 'not-observed',
    'SSO 部署生成器定义 MinIO，业务通过对象存储接口访问。',
    '本次集群 workload / Service 清单未见 MinIO。', ['object-store']),
  fact('sso-clickhouse', '事件分析存储', 'SSO 数据', 'ClickHouse', 'not-observed',
    'SSO 源码提供事件消费与 ClickHouse 分析链路；当前部署生成器不包含 ClickHouse workload。',
    '本次集群 workload / Service 清单未见 ClickHouse。', ['clickhouse']),
  fact('sso-mcp', '教学数据 MCP', 'SSO', 'MCP · memory/profile/asset/project', 'not-observed',
    '已有 MCP 服务与四个 toolset，默认只读；它不是客户端 Agent loop。',
    '源码存在，本次集群未见对应 workload。', ['backend-api']),
  fact('case-management', '案例教学应用', '独立业务', 'Vue · FastAPI · PostgreSQL/Redis/S3', 'not-observed',
    '案例、课题、审核、知识卡片等已有独立应用；保留自身账号与数据边界，尚未替换为平台统一身份。',
    'AI-MEM 已导入源码；本次集群未见对应 workload。未画成已接入 Keycloak 或平台共享库。', ['backend-api', 'postgres', 'object-store']),
  fact('case-data', '案例应用独立存储', '独立业务', 'PostgreSQL · Redis · S3', 'source',
    '案例应用依赖数据库、缓存与对象存储接口；保留独立配置与账号，不画成与 SSO 共享存储实例。',
    '依据案例应用 README；本次未读取应用凭据或运行数据。', ['postgres', 'object-store']),
  fact('llmwiki', 'LLMWiki 知识中枢', '独立业务', 'Python · REST/SSE/MCP', 'not-observed',
    '已有异构资料摄入、Wiki 编译、图谱、混合检索与对话；独立运行，尚未接入统一身份与平台服务。支持 systemd 或用户级部署。',
    'AI-MEM 已导入源码；本次 Kubernetes 清单未见对应 workload。未据此推断其他主机或用户进程的状态。', ['backend-api']),
  fact('wiki-data', 'Wiki 本地工作空间', '独立业务', 'Markdown · SQLite FTS5', 'source',
    'LLMWiki 的内容文件、索引、任务与图谱保存在自身工作空间，不依赖平台 PostgreSQL 或 MinIO。',
    '依据 LLMWiki README 与独立部署说明；运行数据未读取。'),
  fact('template-database', '网关部署模板依赖', '部署模板', 'MySQL · Redis', 'source',
    'server/deploy/ai-platform 的旧 new-api 模板采用独立 MySQL TLS 与 Redis；不是 MEM-AI 当前已明确的 PostgreSQL 目标方案。',
    '只读核对旧模板；本次集群没有 new-api workload、MySQL 或 Redis。不将旧模板连接为目标数据库。'),
]

function edge(id: string, source: string, target: string, label: string, evidence: TechnicalFlow['evidence'], detail = label): TechnicalFlow {
  return { id, source, target, label, evidence, detail }
}
export const technicalFlows: TechnicalFlow[] = [
  ...currentFlows.map(flow => ({ ...flow, evidence: flow.state === 'planned' ? 'planned' as const : 'source' as const })),
  edge('cluster-ingress', 'kubernetes', 'apisix', '承载', 'observed'),
  edge('cluster-network', 'kubernetes', 'calico', 'Pod 网络', 'observed'),
  edge('cluster-dns', 'kubernetes', 'coredns', '服务发现', 'observed'),
  edge('cluster-metrics', 'kubernetes', 'metrics', '资源指标', 'observed'),
  edge('cluster-storage', 'kubernetes', 'local-storage', '持久卷', 'observed'),
  edge('cluster-controller', 'kubernetes', 'ingress-controller', '承载控制器', 'observed'),
  edge('cluster-certs', 'kubernetes', 'cert-manager', '证书控制', 'observed'),
  edge('ingress-config', 'ingress-controller', 'apisix', '路由配置', 'observed'),
  edge('gateway-config-store', 'apisix', 'apisix-etcd', '配置存储', 'observed'),
  edge('identity-route', 'apisix', 'sso-identity', 'Service 8080', 'observed'),
  edge('model-route', 'apisix', 'mem-gateway', 'Service 3000 · 1 就绪端点', 'observed'),
  edge('identity-db', 'sso-identity', 'sso-postgres', '独立身份逻辑库', 'observed'),
  edge('model-postgres', 'mem-gateway', 'mem-postgres', 'PostgreSQL · 已接入', 'observed', 'SQL_DSN 指向集群 PostgreSQL Service，数据库侧已见网关逻辑库连接；不是完整推理链路验收。'),
  edge('model-db-instance', 'mem-postgres', 'sso-postgres', '同一实例 · 独立逻辑库', 'observed'),
  edge('postgres-volume', 'sso-postgres', 'local-storage', 'postgres-data · 20Gi PVC', 'observed'),
  edge('model-files', 'mem-gateway', 'mem-files', '挂载 /data · 非 SQL 主库', 'observed'),
  edge('model-files-volume', 'mem-files', 'local-storage', 'mem-ai-data · 1Gi PVC', 'observed'),
  edge('etcd-volume', 'apisix-etcd', 'local-storage', '5Gi PVC', 'observed'),
  edge('hub-redis', 'sso-hub', 'sso-redis', '缓存 / 限流', 'source'),
  edge('hub-assets', 'sso-hub', 'sso-minio', '资产 S3', 'source'),
  edge('event-stream', 'sso-events', 'sso-redis', '事件 Stream', 'source'),
  edge('event-analysis', 'sso-events', 'sso-clickhouse', '事件分析', 'source'),
  edge('mcp-api', 'sso-mcp', 'sso-hub', '业务 API', 'source'),
  edge('wiki-workspace', 'llmwiki', 'wiki-data', '独立工作空间', 'source'),
  edge('case-storage', 'case-management', 'case-data', '独立数据依赖', 'source'),
]
