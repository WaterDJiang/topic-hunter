# Topic Hunter

Topic Hunter 是面向内容创作者的开源 Chrome 插件项目：在正常浏览 X 时收集高表现短内容，保留指标与来源；单条素材可快速改写并复制短推，多条素材可深挖成选题。

**当前状态：0.1.0 本地开发版。** WXT 插件已能构建并在 Chromium 加载；模拟 X 响应、侧栏与全页流程有自动化验证。五类真实 X 页面、真实 AI 接口和选题效果仍待实测，不作为已完成发行版。

## 本地安装

要求 Node.js 22+、pnpm 10.29.3、Chrome 桌面版。

```bash
pnpm install --frozen-lockfile
pnpm build
```

打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择本项目的 `.output/chrome-mv3`。点击工具栏图标打开侧栏，再正常浏览 `x.com`。插件只观察你已打开页面加载的帖子；设置中可以暂停采集、调整筛选规则，或配置可选的 HTTPS Chat Completions 接口。

要生成可安装 ZIP，运行 `pnpm zip`；文件位于 `.output/`。ZIP 只是本地构建产物，尚未公开发布。

## 开发与验证

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm zip
python3 scripts/check_docs.py
```

`pnpm test:e2e` 会先构建扩展，再用本机 Chromium 加载它；测试使用虚构帖子和模拟 X 响应，不访问你的 X 账号。macOS 沙箱可能阻止 Chromium 启动，此时需在允许本机浏览器运行的环境执行。

## 从哪里开始

- [产品规格](specs/INDEX.md)：现行需求与验收标准。
- [项目文档](doc/INDEX.md)：调研、设计、计划与日志。
- [开发约定](AGENTS.md)：所有 Agent 共用的长期规则。
- [贡献说明](CONTRIBUTING.md)：本地开发和提交约定。

## 产品方向

首版从素材分两条路：「快速改写 → 编辑 → 复制稿件，自行到 X 粘贴发布」和「多帖深挖 → 生成选题 → 人工采用」。快速稿不自动进入选题库。默认数据留在浏览器本地；用户点击生成后，才将所选素材发送到自行配置的 AI 接口。没有接口配置时，可以复制对应任务的提示词，也可手写快速稿。

界面由 X 原帖上的轻量入口、Chrome 侧栏，以及全页素材库和选题库组成。详细界面与状态见 [UI 方案](doc/design/2026-09-13-ui-experience.md)。

## 开源与来源

项目以 [MIT 许可证](LICENSE) 提供。参考项目的能力与复用边界见 [调研记录](doc/ref/2026-09-13-open-source-landscape.md)；引用或移植上游代码时，必须先核实相应文件的授权并保留声明。当前仓库未引入参考项目源码。数据处理方式见[隐私说明](PRIVACY.md)。

Topic Hunter 与 X 无关联。产品只处理用户浏览时已呈现的数据，不代表 X 官方数据服务。
