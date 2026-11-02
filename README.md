# ArchitecturePlanner

[在线规划台](https://thu-mem.github.io/ArchitecturePlanner/) · [React Flow](https://reactflow.dev/)

以 AI-MEM 原始架构为内容基线，用 React + Vite + React Flow 编辑模块、布局、关系和分工。模块及技术组件均支持一位主 owner、多位协作 owner，组件映射可编辑。以原色 SVG 展示技术，说明按需展开。Owner 是规划信息，不是账号或权限。

## 使用

页面默认展示已合入并部署的规划；本地草稿需点击恢复，不会遮住正式版本。选择团队成员后，可给模块或技术组件应用分工，也可手动添加参与者。应用修改只保存到当前浏览器，点击「提交 PR」交给仓库维护者审核，合入后自动发布。JSON 导入、导出可用于备份或交接；文件包含参与者及分工，请谨慎分享。原始架构是只读参考，不随规划编辑反写。

经授权公开的 GitHub 昵称可通过仓库 Actions 变量 `VITE_GITHUB_PARTICIPANTS` 配置为 `[{ "id": 101, "login": "example-owner" }]`，重新部署后会直接出现在参与者及 owner 选项中，无需访问者登录 GitHub。**该变量会进入公开页面，不是秘密存储**；不要填写 token、邮箱、真实姓名或未获公开授权的名单。恢复草稿、导入文件和加载仓库规划都会合并参与者而非重置分工；相同账号重复加载不会重复添加，移出配置也不自动删除已有负责人。

「项目现状」对照 SSO 源码快照和公开 MEM-AI 上游，展示身份、业务数据、模型转发与余额接入的实际职责和链路，并可跳转分工。实线表示已有代码，虚线表示待接入，不表示生产部署已验收。MEM-AI 与 AIMEM-LLMWiki 是不同项目；规划台自身不使用 SSO。现状单独维护，不自动覆盖已有草稿、开展状态或原始规划。

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

## 通过 PR 发布规划

[`src/seed-plan.json`](src/seed-plan.json) 是正式规划的数据源。页面直接调用 GitHub REST API，在独立分支中仅修改该 JSON 并创建 PR，不直接修改主分支、不自动合并，也不自行处理一致性或冲突。PR 检查规划结构与引用，维护者审核差异并合入；现有 Pages 工作流负责构建和发布。没有外部数据库、SSO 或 Cloudflare 依赖。

提交者需有本仓库写权限，并临时输入仅限此仓库、具有 **Contents / Pull requests 读写权限**的短期细粒度 Token。组织可能要求审批；Token 权限不能缩小到单个文件。GitHub 网页登录状态不能直接代替 API 授权。Token 仅在页面内存中保留，提交成功、关闭面板或刷新后清除；不要写进 JSON、仓库或任何 `VITE_*` 变量。

提交成功后页面返回 PR 链接。失败时保留本地草稿；分支或 PR 可能已创建时会提供检查入口，请先检查再重试，避免重复提交。提案与合入后的分工均在公开仓库中可见，只提交获授权公开的规划信息。现有浏览器草稿需由持有人恢复或导入备份后提交，不会自动上传。

规划结构与大小限制以 `src/plan.ts` 为准。回退已发布规划可在 GitHub 中 revert 对应变更，再由 Pages 重新部署。自动测试使用固定的原始架构夹具和模拟 GitHub 响应，不创建远端 PR。

## 来源与许可

`public/architecture.html` 是经授权发布的 AI-MEM 原始架构内容，技术选型是候选规划，不代表已经部署；其图标及第三方来源声明完整保留。正式规划由该文档的模块、组件和映射初始化，后续通过 PR 独立维护。

新工具代码采用 MIT 许可；第三方依赖及图标仍适用各自许可与声明。新增 SVG 的来源和许可见 [图标声明](public/THIRD-PARTY-NOTICES.txt)。Logo 依据组件的技术信息显示，不代表已部署或品牌背书。
