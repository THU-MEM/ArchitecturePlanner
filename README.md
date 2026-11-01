# ArchitecturePlanner

[在线规划台](https://thu-mem.github.io/ArchitecturePlanner/) · [React Flow](https://reactflow.dev/)

以 AI-MEM 原始架构为内容基线，用 React + Vite + React Flow 编辑模块、布局、关系和分工。模块及技术组件均支持一位主 owner、多位协作 owner，组件映射可编辑。以原色 SVG 展示技术，说明按需展开。Owner 是规划信息，不是账号或权限。

## 使用

添加团队成员后，选择模块或技术组件并应用分工。修改默认只保存到当前浏览器，可通过 JSON 导入、导出备份或交接。公开页面不预填真实人员；导出文件包含你填写的信息，请谨慎分享。原始架构是只读参考，不随规划编辑反写。

```sh
npm ci
npm run dev
```

运行要求见 `package.json`。生产构建使用 GitHub Pages 项目路径；部署由 Pages 工作流完成。

```sh
npm test
npm run lint
npm run build
npx wrangler d1 migrations apply DB --local
npx playwright install chromium
npm run test:browser
```

## 可选共享 API

GitHub Pages 本身不存储团队数据。需要跨设备协作时，可部署附带的 Cloudflare Workers + D1：只存一份规划 JSON 和递增版本，不引入账号系统或复杂业务表。

```sh
npx wrangler login
npx wrangler d1 create architecture-planner
```

将创建结果的数据库 ID 填入 `wrangler.jsonc`，核对 `ALLOWED_ORIGIN` 为实际页面的 origin，再执行：

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put EDITOR_TOKEN
npm run api:deploy
```

设置至少 32 个字符的高熵随机 token；不要提交 token 或将其设置成 `VITE_*` 变量。页面的「共享 API」中输入可信的 HTTPS 服务地址和 token，先读取再保存。Token 仅在页面内存中保留；共享 token 持有人具有整个规划的读写权限，需要细分权限时应另行接入身份系统。

| 接口 | 契约 |
|---|---|
| `GET /health` | 仅服务存活状态，不含规划数据 |
| `GET /api/plan` | Bearer 授权；返回 `{ plan, revision }` |
| `PUT /api/plan` | Bearer 授权；提交 `{ plan, revision }`，成功返回新版本 |

规划结构和限制以 `src/plan.ts` 为准。写入采用版本比较：冲突返回 `409`，不会覆盖他人修改。先导出本地草稿，再读取最新版本并手动合并。CORS 只允许配置的页面 origin，但不能替代授权；无 Origin 的授权 CLI 请求也可使用。

本地 API 测试只使用本地 D1 和明确标注的测试 token，不访问生产数据。API 未配置或不可用时，页面仍可使用本地规划模式。

## 来源与许可

`public/architecture.html` 是经授权发布的 AI-MEM 原始架构内容，技术选型是候选规划，不代表已经部署；其图标及第三方来源声明完整保留。`src/seed-plan.json` 由该文档的模块、组件和映射投影生成，初始人员及关系为空。

新工具代码采用 MIT 许可；第三方依赖及图标仍适用各自许可与声明。新增 SVG 的来源和许可见 [图标声明](public/THIRD-PARTY-NOTICES.txt)。Logo 依据组件的技术信息显示，不代表已部署或品牌背书。
