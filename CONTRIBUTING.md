# 贡献说明

认领开发任务前，先读 [有效规格](specs/INDEX.md)、[当前计划](doc/plan/INDEX.md) 和 [Agent 约定](AGENTS.md)。本地开发环境按 [README](README.md) 安装；提交前运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 与 `python3 scripts/check_docs.py`。涉及界面或采集路径时再运行 `pnpm test:e2e`。

- 提议改变产品行为：先更新对应 Spec 和验收，再更新计划；不要只改 Log。
- 实现开源参考能力：先在 `doc/ref/` 记录来源、许可证、固定提交和实际复用范围。
- 提交采集解析改动：附脱敏响应样本与结构断言，说明是否影响原页面请求和指标来源。
- 提交 UI 改动：对照 [UI 方案](doc/design/2026-09-13-ui-experience.md) 验证适用的加载、空、错误、成功与键盘状态。
- 提交品牌改动：保留[生图原件与可编辑描摹](brand/README.md)，重生四档图标并检查 16px 可辨性。
- 提交格式：`type(scope): 中文或英文简述`，`type` 用 `docs`、`feat`、`fix`、`test`、`chore` 等。

安全问题按[安全报告](SECURITY.md)处理；issue、PR、测试夹具中不得包含 API 密钥、Cookie 或真实用户采集数据。

真实 X 页面兼容性、长时间浏览、AI 服务返回和用户选题盲评须在 Log 写清测试环境与证据；模拟样本通过不能代替这些验收。
