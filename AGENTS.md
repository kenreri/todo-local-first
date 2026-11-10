# 个人工作台（local-first）

Codex / 其他 Agent 先读本文件。跨 Agent 工作流见 `跨Agent协作方案.md`。  
详细规划以 `ROADMAP.md`、`开发入门导读.md` 为准（必须是 UTF-8）。

## 开工清单（每次新对话先做）

1. 读本文件（硬约束）。
2. 读 `CURRENT.md` 确认**下一刀**；若与用户提示冲突，以用户指定切片为准。
3. 若无 `CURRENT.md` 或未写明下一刀：看 `ROADMAP.md` 未勾选的最早项（默认大阶段为 **M5**；可选 Tauri 不算；CURRENT 明确的质量切片或暂缓安排优先）。
4. 扫 `经验手册.md` 中与本次主题相关的条目，避免重复踩坑。
5. 改 UI 先读 `design.md`；改数据先读 `src/db.ts`、`src/types.ts` 与现有写入路径。
6. 需要界面时用 `pnpm dev`，浏览器只开 http://127.0.0.1:5173/（勿混用 localhost）；本机生产服务占用端口时按 [部署运维](docs/部署运维.md) 先停止服务。
7. 验证：`pnpm lint`、`pnpm test`、`pnpm build`。

用户说「继续开发」时：按上面 2→3 执行，不要从 M1 重写。

## 产品与边界

- 个人工作台：自由收集事情、想法、笔记、链接和本地文件，连接任务、DDL、日历与轻量专注；原有生活与回顾保留。用户范围仅个人。
- 2026-11-11 产品转向：现有 Obsidian / Zotero / VS Code 继续承担专业工作；音乐与陪伴先做轻量功能，完整沉浸空间后置。
- M1–M4：纯 local-first（React + Dexie/IndexedDB，无后端）。
- 当前进度与下一刀只以 `CURRENT.md` 为准；里程碑完成记录见 `ROADMAP.md`。M5 尚未实施，可选 Tauri 默认不做。
- 不引入：CRDT、Redux、过早后端、Ant Design / shadcn（UI 已定为自定义 Tailwind）。
- 不要顺手做可选 Tauri。

## 技术栈

- React 19 + TypeScript + Vite 8；Zustand；Dexie；Tailwind 4；History API 导航；Recharts；PWA（`vite-plugin-pwa`）
- 日历：FullCalendar；拖拽：@dnd-kit
- 包管理：`pnpm`
- 验证：`pnpm lint`、`pnpm test`、`pnpm build`；本地预览：`pnpm dev`

## 视图

工作台 / 今天 / 任务（清单、列表、日历）/ 生活（习惯、看番）/ 专注 / 回顾。历史 M2 的看板不代表当前导航。

## UI 颜色（改界面必守）

新增页面或修改界面前必须先读 `design.md`；当前定稿的字阶、间距、圆角、阴影、布局与
浅色 / 深色具体色值以该文件为准。

唯一色源：`src/index.css`（`:root` 浅色，`html[data-theme='dark']` 深色）。组件只引用 CSS 变量。

禁止：`bg-white` / `bg-black` / `text-white`（除非对应 token）、Tailwind 调色盘色（如 `red-50`）、内联 `#hex` / `rgb()`（清单色点、优先级左边线等语义色除外，且应走 token）。

| Token                                        | 用途                                 |
| -------------------------------------------- | ------------------------------------ |
| `--bg` / `--bg-elevated`                     | 页面底 / 卡片底                      |
| `--ink` / `--muted` / `--line`               | 正文 / 次要文字 / 边框               |
| `--accent` / `--on-accent` / `--accent-soft` | 主按钮与选中态 / 其上文字 / 浅底高亮 |
| `--surface` / `--surface-input`              | 浅层表面 / 输入框背景                |
| `--chip` / `--hover`                         | 标签底 / 悬停                        |
| `--danger` / `--danger-soft`                 | 危险操作                             |
| `--priority-high/medium/low/none`            | 任务优先级                           |

- 主按钮固定：`bg-[var(--accent)] text-[var(--on-accent)]`
- 选中态与主按钮使用同一 accent 色系，不随视图切换变色；具体实底/浅底规则按 `design.md` 与现有控件
- 新增颜色先加 token（浅 + 深各一份），再引用
- 改 UI 必须浅色、深色各看一眼：输入框、按钮字、选中态、边框
- 不要给 `button` 写全局 `color: inherit`
- 优先级用 `PriorityBadge` + `--priority-*`
- 图表 / FullCalendar 也尽量绑 token
- 界面中文为主，兼容英文切换

## 数据层

- 普通业务记录用 `crypto.randomUUID()`，带 `createdAt` / `updatedAt` / `deletedAt`，日常删除为软删除；`pomodoroRecords` 只追加且仅有 `createdAt`，`settings` 固定主键 `app` 并带 `updatedAt`。JSON 恢复可在事务中替换业务集合。
- 表：`lists`、`tasks`、`habits`、`habitCheckIns`、`anime`、`pomodoroRecords`（append-only）、`settings`（单行 LWW）、`workspaceItems`、`attachments`、`attachmentBlobs`。附件元数据带时间戳/软删除，字节表按附件 ID 保存 Blob；日常删除保留字节，完整 JSON 备份包括文件内容。
- 改结构只走 Dexie 递增 `version(n)` + 迁移函数
- 重复任务用虚实例按规则实时计算，禁止物理复制未来任务
- M5 才补 `ownerId`；冲突策略仅 LWW，不上 CRDT
- 保留 JSON 导出/导入与 CSV 任务导出；当前没有 CSV 导入，不把它写成完整恢复能力

写入路径：UI → Zustand（必要时）→ Dexie；刷新后数据仍在。

## 里程碑

下表描述历史阶段范围，当前界面与能力以源码及 `CURRENT.md` 为准。

| 阶段 | 必须交付                                                     | 明确不做                    |
| ---- | ------------------------------------------------------------ | --------------------------- |
| M1   | 清单/任务 CRUD、子任务/标签/筛选、Dexie、同步友好 schema     | 后端、同步、PWA、日历多视图 |
| M2   | 列表/看板/日历、重复任务虚实例、dnd-kit                      | 番茄钟、账号                |
| M3   | 番茄计时绑定任务、统计图、到期提醒                           | 多端同步                    |
| M4   | 主题/快捷键/批量、JSON/CSV、PWA；可选 Tauri                  | 完整同步协议                |
| M5   | 账号、Supabase 或自建 Node、增量拉取/推送、pending 队列、LWW | CRDT                        |

## 习惯

- 默认只做当前目标切片，不提前实现后续阶段
- 文档总入口：[README](README.md)；评估、运维与验收专题放 `docs/`，职责见 [跨 Agent 协作方案](跨Agent协作方案.md)。
- 文档 SSOT：`ROADMAP.md` = 勾选完成态；`开发日志.md` = 切片叙事；`CURRENT.md` = 下一刀；`经验手册.md` = 避坑；本文件 = 约束与开工/收工
- 回复用简体中文
- 不要主动 git commit / push，除非用户明确要求

## 收工检查表（每切片结束必做）

- [ ] `pnpm lint` / `pnpm test` / `pnpm build` 通过（或写明已知失败原因）
- [ ] `开发日志.md` 顶部已追加一节（日期、原因、实现要点、验证、未做边界），风格对齐既有条目
- [ ] `CURRENT.md` 已更新下一刀 / 进行中 / 阻塞
- [ ] 若完成 `ROADMAP.md` 某勾选项 → 已勾选；不要改写历史已勾选叙述，除非本次明确新增可勾选切片
- [ ] 若有可复用坑 → `经验手册.md` 已追加（症状 / 原因 / 避坑）
- [ ] 未擅自 commit / push
- [ ] 未误开后续阶段或引入禁栈（除非本切片就是该阶段）
