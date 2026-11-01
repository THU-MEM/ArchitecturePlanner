export type ImplementationState = 'implemented' | 'planned'
export const implementationStates = { implemented: '源码已实现', planned: '待接入' }

export type ProjectFact = {
  id: string
  name: string
  project: string
  state: ImplementationState
  stack: string
  detail: string
  components: string[]
  modules: string[]
  position: { x: number; y: number }
  sources: { label: string; href?: string }[]
}

const memSource = 'https://github.com/MindxMotion/MEM-AI/blob/mindxmotion/'
const snapshot = [{ label: 'SSO 仓库内源码快照（仅公开职责摘要）' }]

export const projectFacts: ProjectFact[] = [
  {
    id: 'sso-console', name: '统一控制台', project: 'SSO', state: 'implemented',
    stack: 'React · keycloak-js', position: { x: 30, y: 0 },
    components: ['console'], modules: ['M13'],
    detail: '已有控制台、门户与个人数据入口；控制台直接使用 keycloak-js 进行 PKCE 登录，业务数据通过 hub-api 访问。外部业务接入 SDK 是另一条接入面，不视为控制台已经使用。',
    sources: snapshot,
  },
  {
    id: 'sso-identity', name: 'Keycloak', project: 'SSO', state: 'implemented',
    stack: 'OIDC · PKCE · JWKS', position: { x: 380, y: 0 },
    components: ['keycloak', 'api-auth', 'user-service', 'access-policy'], modules: ['M17'],
    detail: '已有统一身份服务、浏览器 PKCE SDK 和服务端 JWT/JWKS 验签、角色与 scope 守卫。身份主体使用 sub；身份互通不等于共享业务权限。微信登录代理仍是骨架。',
    sources: snapshot,
  },
  {
    id: 'mem-web', name: 'MEM-AI 控制台', project: 'MEM-AI', state: 'implemented',
    stack: 'React · Rsbuild · OIDC', position: { x: 730, y: 0 },
    components: ['console'], modules: ['M16'],
    detail: 'MEM-AI 是 New API 衍生的模型网关工程，不是 AIMEM-LLMWiki。已有 Web 管理端与 OIDC 登录能力；是否启用取决于服务端配置。',
    sources: [{ label: '公开 MEM-AI 工程', href: 'https://github.com/MindxMotion/MEM-AI' }],
  },
  {
    id: 'sso-hub', name: 'hub-api', project: 'SSO', state: 'implemented',
    stack: 'NestJS · REST · JWT', position: { x: 30, y: 165 },
    components: ['backend-api', 'profile-service', 'memory-service', 'project-service', 'course-service'],
    modules: ['M01', 'M03', 'M06', 'M09', 'M13', 'M22'],
    detail: '已有画像、记忆、掌握度、资产、课题、课程及业务接口。这些是业务模块可复用的基础能力，不代表完整学伴、测评或教学流程已交付。',
    sources: snapshot,
  },
  {
    id: 'balance-integration', name: '余额接入', project: 'SSO ↔ MEM-AI', state: 'implemented',
    stack: 'client_credentials · balance:read', position: { x: 380, y: 165 },
    components: ['usage-service'], modules: ['M16'],
    detail: 'SSO 服务端按已登录用户的 sub 查询 MEM-AI 余额；两端接入代码已具备，凭证仅在服务端。余额与模型消费以 MEM-AI 为准，不表示教学计费已统一。',
    sources: [...snapshot, { label: 'MEM-AI 集成接口', href: `${memSource}router/integration-router.go` }],
  },
  {
    id: 'mem-gateway', name: 'MEM-AI 模型网关', project: 'MEM-AI', state: 'implemented',
    stack: 'Go · Gin · Streaming', position: { x: 730, y: 165 },
    components: ['model-gateway', 'provider-adapter', 'usage-service'], modules: ['M16', 'M18'],
    detail: '已有模型路由、Provider 适配、流式转发、模型 API key、额度与调用记录。OIDC 登录、模型调用和集成服务凭证各有独立用途；不把身份 token 当模型 key。',
    sources: [{ label: '模型路由', href: `${memSource}router/relay-router.go` }, { label: 'OIDC 实现', href: `${memSource}oauth/oidc.go` }],
  },
  {
    id: 'sso-events', name: '事件管道', project: 'SSO', state: 'implemented',
    stack: 'Fastify · Redis Streams', position: { x: 30, y: 330 },
    components: ['event-ingest', 'redis-stream', 'clickhouse'], modules: ['M11'],
    detail: '已有批量事件接收、逐条确认、PostgreSQL 持久化、Redis Stream 与 ClickHouse 消费链路；Keycloak 事件有服务端转发器。外部业务 SDK 也支持上报，但新业务仍需注册事件并联调，不能把有管道当成所有行为已接入。',
    sources: snapshot,
  },
  {
    id: 'client-integration', name: '业务应用 · Agent', project: 'AI-MEM', state: 'planned',
    stack: '客户端 Agent loop', position: { x: 380, y: 330 },
    components: ['workspace', 'client-loop'], modules: ['M05', 'M06'],
    detail: '交互式 Agent loop 保持在客户端；通过业务 API 和模型网关调用服务，不直接连接存储或持有 Provider 密钥。完整业务应用的身份、数据与模型联调仍待完成。',
    sources: [{ label: 'AI-MEM 原始规划与仓库集成边界' }],
  },
  {
    id: 'mem-providers', name: '模型 Provider', project: 'MEM-AI', state: 'implemented',
    stack: 'Provider Adapter · HTTP/SSE', position: { x: 730, y: 330 },
    components: ['provider-adapter', 'external-model'], modules: ['M16', 'M18'],
    detail: '已有多 Provider 协议适配能力；实际模型与可用额度由运行配置决定。适配器存在不代表所有厂商已开通，也不代表算力调度系统已实现。',
    sources: [{ label: '公开 Provider 适配器', href: 'https://github.com/MindxMotion/MEM-AI/tree/mindxmotion/relay/channel' }],
  },
  {
    id: 'sso-data', name: '教学数据中心', project: 'SSO', state: 'implemented',
    stack: 'PostgreSQL · pgvector · MinIO · ClickHouse', position: { x: 30, y: 495 },
    components: ['postgres', 'object-store', 'clickhouse', 'vector-index'], modules: ['M11', 'M15'],
    detail: '教学业务数据、向量、资产和分析存储属于 SSO 数据中心。已有知识点与业务图谱能力，但 GraphScope、OpenSPG、KAG 等仍是候选，不视为已部署。',
    sources: snapshot,
  },
  {
    id: 'mem-data', name: '网关数据', project: 'MEM-AI', state: 'implemented',
    stack: 'PostgreSQL · Redis · GORM', position: { x: 730, y: 495 },
    components: ['postgres'], modules: ['M16'],
    detail: 'MEM-AI 独立维护账户、模型 key、渠道、额度和日志。默认 Compose 提供 PostgreSQL 与 Redis，数据库驱动另支持其他后端；不与教学数据中心共享数据库或权限。',
    sources: [{ label: '公开默认编排（不是生产清单）', href: `${memSource}docker-compose.yml` }],
  },
]

export const currentFlows: {
  id: string; source: string; target: string; label: string; state: ImplementationState; detail: string
  sourcePort?: 'left' | 'right' | 'bottom'; targetPort?: 'left' | 'right' | 'top'
}[] = [
  { id: 'console-login', source: 'sso-console', target: 'sso-identity', sourcePort: 'right', targetPort: 'left', label: 'PKCE', state: 'implemented', detail: '控制台直接通过 keycloak-js 进行 PKCE 登录。' },
  { id: 'mem-login', source: 'mem-web', target: 'sso-identity', sourcePort: 'left', targetPort: 'right', label: 'OIDC', state: 'implemented', detail: '已具备 OIDC 接入能力；生产启用情况未核验。' },
  { id: 'console-data', source: 'sso-console', target: 'sso-hub', label: '用户 JWT', state: 'implemented', detail: '业务接口验签并执行权限守卫。' },
  { id: 'mem-session', source: 'mem-web', target: 'mem-gateway', label: '网关会话', state: 'implemented', detail: 'OIDC 登录后使用 MEM-AI 自身会话与业务权限。' },
  { id: 'sso-balance', source: 'sso-hub', target: 'balance-integration', sourcePort: 'right', targetPort: 'left', label: '本人 sub', state: 'implemented', detail: '服务端依据已认证主体查询，不信任浏览器传入他人身份。' },
  { id: 'balance-read', source: 'balance-integration', target: 'mem-gateway', sourcePort: 'right', targetPort: 'left', label: 'balance:read', state: 'implemented', detail: '使用独立 client_credentials 服务凭证；不是模型 key。' },
  { id: 'event-track', source: 'sso-identity', target: 'sso-events', sourcePort: 'left', targetPort: 'right', label: '', state: 'implemented', detail: 'Keycloak 身份事件通过服务端转发器进入事件管道；不是控制台调用外部业务 SDK。' },
  { id: 'events-store', source: 'sso-events', target: 'sso-data', label: '持久化 · 分析', state: 'implemented', detail: 'PostgreSQL、Stream 与 ClickHouse 事件链路。' },
  { id: 'hub-store', source: 'sso-hub', target: 'sso-data', sourcePort: 'left', targetPort: 'left', label: '业务数据', state: 'implemented', detail: 'hub-api 维护教学数据，不直接写网关账户库。' },
  { id: 'provider-relay', source: 'mem-gateway', target: 'mem-providers', label: '路由 · 流式', state: 'implemented', detail: 'Provider 凭证保留在网关服务端。' },
  { id: 'gateway-store', source: 'mem-gateway', target: 'mem-data', sourcePort: 'right', targetPort: 'right', label: '账户 · 额度', state: 'implemented', detail: '模型账户与额度由 MEM-AI 独立维护。' },
  { id: 'client-hub', source: 'client-integration', target: 'sso-hub', sourcePort: 'left', targetPort: 'right', label: '业务 API', state: 'planned', detail: '完整业务应用的统一身份和数据接入待联调。' },
  { id: 'client-events', source: 'client-integration', target: 'sso-events', sourcePort: 'left', targetPort: 'right', label: 'SDK 事件', state: 'planned', detail: '外部业务应用的 SDK 与事件注册接入仍待联调。' },
  { id: 'client-model', source: 'client-integration', target: 'mem-gateway', sourcePort: 'right', targetPort: 'left', label: '模型 API key', state: 'planned', detail: '规划的模型调用通过网关；不能用用户 SSO token 替代模型 key。' },
]
