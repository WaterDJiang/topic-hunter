# X 高表现内容工具调研

- 核验日期：2026-09-13。
- 方法：阅读公开仓库 README、可访问的部分源码及 Chrome/WXT 官方文档；未安装运行候选项目，未验证 X 的实时响应结构。
- 等级：**文档级**＝功能与限制来自项目说明；**源码抽查**＝看到具体实现片段；**运行级**＝安装后实测。本轮没有运行级证据。
- 复用纪律：能力参考不等于代码复用。移植代码前固定上游提交、核实目标文件授权、保留版权声明并增加本项目测试。

| 项目 | 来源与授权核验 | 借鉴价值 | 不直接采用的原因 | 证据等级 |
|---|---|---|---|---|
| [x-viral-monitor](https://github.com/Icy-Cat/x-viral-monitor) | [MIT LICENSE](https://github.com/Icy-Cat/x-viral-monitor/blob/main/LICENSE) | GraphQL 响应观察、流速徽章、热度榜、指标抽取 | 产品包含图片增强、评论生成和授权闸门；Topic Hunter 的核心是选题库 | README＋[网络观察源码](https://raw.githubusercontent.com/Icy-Cat/x-viral-monitor/main/lib/x-net-hook.js)抽查 |
| [xTap](https://github.com/mkubicek/xTap) | 仓库显示 MIT；移植时复核文件级授权 | 被动捕获、结构化样本、多标签去重、暂停恢复 | 数据写入依赖本地守护进程；首版只用浏览器本地存储 | README 级 |
| [XRayFeed](https://github.com/demetriuszhomir/XRayFeed) | 仓库显示 MIT；移植时复核文件级授权 | 多指标阈值、原帖高亮、启停控制 | README 明确只覆盖 `x.com/home`；首版需求含搜索、列表、主页、详情 | README 级 |
| [X Copilot](https://github.com/baryon/x-copilot) | README 标注 MIT；移植时复核文件级授权 | 本地素材检索、全页与侧栏配合、AI 分析、Markdown 导出 | 主流程围绕书签与回复，选题对象不同 | README 级 |
| [Twitter Monitor](https://github.com/reflective-technologies/twitter-monitor) | README 标注 MIT；移植时复核文件级授权 | 语义聚类、带原帖引用的摘要 | Python 管线与凭据方式不适合浏览器内首版；多帖手选先于自动聚类 | README 级 |
| [xarchive](https://github.com/sytelus/xarchive) | 本轮未核实许可证；复用源码前必须核验 | 书签归档、暂停恢复、导出查看 | 主动书签拉取不属于随浏览首版 | README 级 |

## 产品结论

1. **采集借鉴，选题自研。** 单点借鉴 `x-viral-monitor` 的响应观察和 `xTap` 的去重思想；不 Fork 任一完整产品。现阶段没有复制上游代码。
2. **展示分工明确。** 原帖只显示入选理由与保存入口；Chrome 侧栏负责边刷边看；全页负责筛选、编辑和选题状态。参考 [X Copilot](https://github.com/baryon/x-copilot) 的多界面分工，避免在 X 页面插入大浮层。
3. **“热”必须解释。** [x-viral-monitor 的平均流速](https://github.com/Icy-Cat/x-viral-monitor#工作原理)按累计浏览和发帖时长计算；Topic Hunter 的“近期增长”必须由两次观测得出。缺少两次观测时不显示增长结论。
4. **聚类延后。** `Twitter Monitor` 的语义聚类对多帖综述有启发，但首版让用户手选 1–10 条素材，不增加 Python 或服务端依赖。

## 技术与商店约束

- [WXT 内容脚本](https://wxt.dev/guide/essentials/content-scripts.html)：支持扩展入口与页面 UI 的组织；真实构建时核对锁定版本与行为。
- [TanStack Virtual](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual)：作为正式依赖用于长素材列表虚拟化；与其他 npm 包的精确版本均见 `pnpm-lock.yaml`。本项目未复制其源码。
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)：侧栏权限与打开行为的依据。
- [Chrome Service Worker 生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)：持久状态不能只放进后台内存。
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)：`storage.local` 默认对内容脚本开放；密钥存储前须设置可信上下文访问级别。
- [Chrome Web Store 用户数据说明](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)：公开发行前需要核对数据用途、权限说明与隐私披露。

## 下一轮需要实测的未知

- 五类 X 页面真实 GraphQL 响应、缺失字段、引用帖结构及 DOM 绑定稳定性。
- 与 `x-viral-monitor` 同时启用时的网络包装顺序、页面功能和性能。
- Chrome 对用户自定义 AI 站点权限申请的实际提示和拒绝路径。
