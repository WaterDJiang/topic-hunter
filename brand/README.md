# Topic Hunter 品牌资产

视觉概念是“从信息流中选中值得写的一句”：三条短线代表浏览时看到的内容，四角捕获框代表发现，青柠高亮代表被挑出的句子，指针提示主动选择。**方向由内置生图能力生成并经用户确认**；生产用 SVG 是根据生成稿制作的可编辑几何描摹。横向标识、社交预览和扩展图标沿用同一图形。颜色与字型以 [UI 设计](../doc/design/2026-09-13-ui-experience.md)为准。

| 文件 | 用途 |
|---|---|
| [logo-generated.png](logo-generated.png) | 内置生图输出的完整品牌概念图，1536×1024，保留生成证据 |
| [icon.svg](icon.svg) | 按生成母版描摹的可编辑矢量版 |
| [wordmark.svg](wordmark.svg) | README 和文档横向标识 |
| [social-preview.svg](social-preview.svg) | 可编辑的仓库社交预览源 |
| [social-preview.png](social-preview.png) | GitHub 设置页上传用，1280×640 |
| `public/icon-16/32/48/128.png` | Chrome Manifest 引用的四档位图 |

Logo 为本项目原创生成图形，不使用 X 官方商标。保留生成原件和 SVG。执行 `node scripts/render_brand.mjs` 从矢量描摹重生四档扩展 PNG 和社交预览 PNG；用 `sips -g pixelWidth -g pixelHeight public/icon-*.png brand/social-preview.png` 核对尺寸。改变图标设计时同步更新生图原件与 SVG 描摹。

生成方向提示词核心：`Create a premium original logo for Topic Hunter. A cobalt open capture frame embraces three short editorial text strokes; the middle stroke is selected with a vivid lime highlight and a tiny cursor notch. Show the same mark beside the wordmark, as a browser toolbar icon, on a dark app tile, and on a short-post card. No circles, binoculars, quotation marks, digits, bird, target or X mark.` 第二轮要求白底、纯色、无光晕与阴影。SVG 描摹保留“框选短句”的结构，并针对 16px 缩小调整线条。
