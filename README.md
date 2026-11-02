# ArchitecturePlanner

[在线规划台](https://thu-mem.github.io/ArchitecturePlanner/) · [React Flow](https://reactflow.dev/)

以 AI-MEM 原始架构为内容基线，用 React + Vite + React Flow 编辑模块、布局、关系和分工。模块及技术组件均支持一位主 owner、多位协作 owner，组件映射可编辑。以原色 SVG 展示技术，说明按需展开。Owner 是规划信息，不是账号或权限。

## 使用

页面默认展示主分支已部署的规划；本地草稿需点击恢复，不会遮住正式版本。选择团队成员后，可给模块或技术组件应用分工，也可手动添加参与者。应用修改只保存到当前浏览器，点击「提交到 GitHub」复制 JSON 并前往原生编辑器提交，进入主分支后自动发布。JSON 导入、导出可用于备份或交接；文件包含参与者及分工，请谨慎分享。原始架构是只读参考，不随规划编辑反写。

经授权公开的 GitHub 昵称可通过仓库 Actions 变量 `VITE_GITHUB_PARTICIPANTS` 配置为 `[{ "id": 101, "login": "example-owner" }]`，重新部署后会直接出现在参与者及 owner 选项中，无需访问者登录 GitHub。**该变量会进入公开页面，不是秘密存储**；不要填写 token、邮箱、真实姓名或未获公开授权的名单。恢复草稿、导入文件和加载仓库规划都会合并参与者而非重置分工；相同账号重复加载不会重复添加，移出配置也不自动删除已有负责人。

「项目现状」对照 SSO 源码快照和公开 MEM-AI 上游，展示身份、业务数据、模型转发与余额接入的实际职责和链路，并可跳转分工。实线表示已有代码，虚线表示待接入，不表示生产部署已验收。MEM-AI 与 AIMEM-LLMWiki 是不同项目；规划台自身不使用 SSO。现状单独维护，不自动覆盖已有草稿、开展状态或原始规划。

正式规划的模块名称、开展状态、主 owner 和依赖于 2026-11-02 按[腾讯分工文档](https://docs.qq.com/sheet/DUHZXUFdHdm13VExI)的「③ 模块一览与认领」实际行及「⑨ 人员与 GitHub 账号映射」同步。保留 GitHub 稳定 ID，仅展示获授权的账号昵称；表内姓名与账号映射仍是待确认的规划依据，不表示组织成员身份、登录权限或已验收。空白认领保留未分配，未臆测协作或技术组件 owner。以当前行的 M22 拼学分、M24 PMO 为准，不采用旧标题或任务编号。箭头表示上游提供方 → 下游模块，保留文档列出的反馈环；选中模块可逐项查看并跳转上、下游。连线较多时默认只显示当前模块的直接依赖，可切换「全部连线」；展示筛选不改变或删减导出的关系。未列明的依赖不额外推断，技术组件映射和只读原始架构保留原有内容。此为人工同步快照，后续仍通过 JSON 与 GitHub 审核更新，不自动写回腾讯文档。

```sh
npm ci
npm run dev
```

运行要求见 `package.json`。生产构建使用 GitHub Pages 项目路径；部署由 Pages 工作流完成。

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

## 通过 GitHub 发布规划

[`src/seed-plan.json`](src/seed-plan.json) 是正式规划的数据源。无需 Token，也不在规划台登录或调用 GitHub 写入 API：

1. 在规划台应用修改，点击「提交到 GitHub」中的「复制并前往 GitHub」。
2. 页面复制完整 JSON 后，在当前标签页打开对应文件的 GitHub 编辑器；必要时先登录 GitHub。
3. 全选替换文件内容，粘贴 JSON，在 GitHub 填写提交说明。有权限时可直接 Commit，也可新建分支提 PR；无直接写权限时按 GitHub 提示通过 fork 提交提案。
4. 变更进入主分支并通过检查后，Pages 自动发布。审核、权限与冲突处理均由 GitHub 和维护者负责。

复制失败时不会跳转或声称提交成功；页面提供可全选的 JSON 和 GitHub 编辑链接，也可导出文件后手动粘贴。复制或打开 GitHub 不代表已经保存到仓库。返回规划台后可恢复本地草稿；现有浏览器分工需由持有人恢复或导入备份后提交，不会自动上传。

提案及已发布分工在公开仓库中可见，只提交获授权公开的规划信息。没有外部数据库、SSO 或 Cloudflare 依赖。规划结构与大小限制以 `src/plan.ts` 为准；回退已发布规划可在 GitHub revert 对应变更，再由 Pages 重新部署。自动测试使用固定的原始架构夹具，验证真实浏览器剪贴板及编辑器跳转，不创建远端提交或 PR。

## 来源与许可

`public/architecture.html` 是经授权发布的 AI-MEM 原始架构内容，技术选型是候选规划，不代表已经部署；其图标及第三方来源声明完整保留。正式规划由该文档的模块、组件和映射初始化，后续通过 PR 独立维护。

新工具代码采用 MIT 许可；第三方依赖及图标仍适用各自许可与声明。新增 SVG 的来源和许可见 [图标声明](public/THIRD-PARTY-NOTICES.txt)。Logo 依据组件的技术信息显示，不代表已部署或品牌背书。
