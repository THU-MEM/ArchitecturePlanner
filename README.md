# ArchitecturePlanner

[在线规划台](https://thu-mem.github.io/ArchitecturePlanner/) · [React Flow](https://reactflow.dev/)

基于 AI-MEM 架构的可编辑规划台，支持模块、技术组件、依赖与分工。模块和组件各支持一位主 owner、多位协作 owner。Owner 仅是规划信息，不授予账号或权限。

## 使用与发布

1. 页面默认展示已发布规划；如需继续浏览器中的修改，点击「恢复本地草稿」。
2. 编辑模块或组件后「应用」，可导入、导出 JSON 备份。此时修改仍只在当前浏览器。
3. 点击「提交到 GitHub」→「复制并前往 GitHub」，在原生编辑器全选粘贴，再 Commit 或提 PR。无需向规划台提供 Token。
4. 变更进入主分支并通过检查后，Pages 自动发布；审核、权限与冲突处理由 GitHub 和维护者负责。

复制失败时可手动复制页面中的 JSON 或导出文件，不会自动跳转。复制和打开 GitHub 不代表已提交，返回后仍可恢复草稿。

**规划与分工会进入公开仓库，导出文件也包含人员信息。只填写获授权公开的昵称与规划内容，不要加入凭据、邮箱或其他个人信息。**

## 数据与边界

[规划 JSON](src/seed-plan.json) 是正式数据源，分工与账号映射由维护者人工核对更新。账号映射仍待确认；空白认领保持未分配，不推断协作或组件负责人。

箭头表示上游 → 下游，保留依赖反馈环。架构画布默认展示全部依赖，由 ELK 按拓扑自动排列模块、减少交叉并绕开节点；相对选中模块，蓝线表示上游、橙线表示下游，其他依赖为灰线。可切换「仅看当前模块」、缩放查看或「重新布局」。自动布局仅改变当前视图，不写入草稿；手动拖动后保存当前模块坐标，拖动相关的线改用动态折线。模块详情支持双向跳转。

成员和分工使用 DiceBear 首字母头像，在浏览器本地生成，不向外部头像服务发送信息，也不改变规划 JSON。

原始架构只读；「项目现状」单独维护 SSO 与 MEM-AI 的源码事实，不自动改变规划状态。已有代码不等于已上线，规划台本身不接入 SSO，也不依赖外部数据库或 API 服务。

部署可通过 `VITE_GITHUB_PARTICIPANTS` 补充获授权公开的 GitHub 昵称，配置格式见[参与者合并逻辑](src/participants.ts)。按稳定账号 ID 合并，不重置已有分工；配置会进入公开页面，不能用于保存秘密。

## 开发

运行要求与命令以 [package.json](package.json) 为准。

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

## 来源与许可

原始架构经授权发布，技术选型仍为候选规划。工具代码采用 MIT 许可；依赖及图标适用各自许可，见[图标声明](public/THIRD-PARTY-NOTICES.txt)。Logo 不代表已部署或品牌背书。
