# 西双版纳红木企业分布 3D 地图

本项目是一个本地 Web 应用，用仿真 3D 科技大屏地图和数据仪表盘展示西双版纳红木企业分布，支持按区域、类型、定位精度、电话和关键词筛选。

地图中每家企业对应一个独立 3D 点位；左侧资料影像参考图可拖动查看，双击可复位。

## 数据说明

- 原始资料：`assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx`
- 视觉参考：`assets/source/ChatGPT Image 2026年7月6日 20_47_57.png`、`assets/source/panorama_cropped.png`
- 当前数据集：78 条企业记录，其中 49 条带电话。
- 当前定位精度统计：`exact` 10 条，`road` 21 条，`area` 47 条，`unknown` 0 条。

定位精度含义：

- `exact`：可定位到较明确的企业点位或明确地点。
- `road`：可定位到道路、街区、园区等近似范围。
- `area`：仅能定位到市县、乡镇或较大区域。
- `unknown`：缺少可用地址信息，无法可靠定位。

地图中的 `schematic` 坐标用于可视化布局和相对分布展示，不是测绘级、调查级或可导航的精确坐标；使用时应结合定位精度等级和外部地图检索结果判断。

## 运行

```bash
pnpm install
pnpm run dev
```

默认开发地址由 Vite 输出，通常是 `http://127.0.0.1:5173`。

## 重新生成数据

```bash
python3 scripts/extract_enterprises.py
```

## 验证

```bash
python3 -m unittest tests/extract_enterprises_test.py -v
pnpm run test
pnpm run build
pnpm run dev
APP_URL=http://127.0.0.1:5173 pnpm run test:browser
```

运行浏览器烟测时需要先保持开发服务器运行；烟测完成后可停止开发服务器。

## Codex / 本地运行时说明

在 Codex desktop 环境中，`node`、`pnpm` 或相关依赖可能需要使用 bundled Node/PATH。可将下面前缀加到 `pnpm` 命令前：

```bash
PATH=/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH CI=true pnpm run test
PATH=/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH CI=true pnpm run build
```

浏览器烟测会优先使用项目本地安装的 `playwright`；如果未安装，可通过 `PLAYWRIGHT_MODULE_PATH` 指向 Playwright 的 ESM 入口。在当前 Codex 环境中，默认 fallback 路径是：

```text
/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

普通本地开发如果没有上述 bundled 路径，可以按需安装：

```bash
pnpm add -D playwright
```

浏览器烟测还需要可启动的浏览器；若没有系统 Chrome 或 Playwright Chromium，请运行：

```bash
pnpm exec playwright install chromium
```
