# Topic Hunter 公开源码仓库规格

- 状态：有效，OSS-01 至 OSS-05 已验收；后续产品验收仍见阶段计划。
- 范围：在 `WaterDJiang/topic-hunter` 建立公开 GitHub 源码仓库，推送当前开发预览版、仓库文档与品牌资产；不提交 Chrome Web Store，不宣称真实 X 或选题效果验收完成。
- 依据：用户明确要求新开开源仓库、建立推送、补齐忽略文件、README、版本和 Logo。

## 目标、范围与影响面

- 公开仓库默认分支为 `main`，本地 `origin` 指向该仓库；推送后核对远端 HEAD 与本地提交一致。
- 用 `package.json` 和扩展 Manifest 的 `0.1.0` 表示当前源码版本；在 `CHANGELOG.md` 标明它是开发预览。若创建 Git 标签，标签指向这次公开源码提交，不自动生成正式发行包或商店发布。
- README 首页可在不登录、不配置 AI 的情况下解释用途、采集边界、安装、运行、验证、隐私和现阶段未验收项。MIT 许可证、贡献说明、隐私说明和安全报告保持可导航。
- `.gitignore` 排除依赖、构建产物、测试产物、环境文件与本地密钥；公开前检查本次改动及全部推送历史，不含密钥、登录凭据或真实用户采集数据。
- Logo 使用生图能力形成图标母版，延续现有蓝色信号与青柠点缀；保留生成原件与可编辑 SVG 描摹、README 横向标识、GitHub 社交预览图，以及扩展使用的 16/32/48/128px PNG。图形在小尺寸保持可辨；不使用 X 官方标识。

## 验收

| ID | 可观察结果 |
|---|---|
| OSS-01 | GitHub 仓库是 public，默认分支 `main`；`git ls-remote origin refs/heads/main` 与本地 `HEAD` 一致。 |
| OSS-02 | `git status --short` 干净；忽略规则覆盖 `.output/`、`node_modules/`、`.pnpm-store/`、测试报告、`.env*` 和本地密钥；公开历史扫描无凭据或真实采集数据。 |
| OSS-03 | README、LICENSE、CONTRIBUTING、PRIVACY、SECURITY、CHANGELOG 可从仓库首页访问；版本与开发预览状态一致，安装命令可执行。 |
| OSS-04 | 生图原件保存在仓库；Logo SVG 可编辑；四种扩展 PNG 尺寸准确、实物检查无裁切，Manifest 指向这些文件；横向与社交预览图保持同一识别元素。 |
| OSS-05 | `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`、`pnpm build`、`pnpm zip` 和 `python3 scripts/check_docs.py` 通过；GitHub CI 状态另行核对。 |

## 不属于本次验收

真实 X 五类页面、30 分钟浏览、真实 AI 供应商、20 组选题盲评与 Chrome Web Store 发行仍按现行 [阶段计划](../doc/plan/2026-09-13-m0-m4-roadmap.md)继续。公开源码不等于功能最终验收。
