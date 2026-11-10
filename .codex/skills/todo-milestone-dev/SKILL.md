---
name: todo-milestone-dev
description: Guides milestone-based development of this local-first TODO app (M1–M5). Use when starting the app, scaffolding Vite/React, implementing lists/tasks/Dexie, views, pomodoro, PWA, or sync, or when the user mentions M1/M2/M3/M4/M5, ROADMAP, CURRENT, 继续开发, or 清单开发.
---

# TODO 清单 · 里程碑开发

先读根目录 `AGENTS.md`，再读 `CURRENT.md`、`经验手册.md`（相关条目）、`ROADMAP.md` 与 `开发入门导读.md`。  
工作流权威说明：`跨Agent协作方案.md`。默认只做当前切片，不提前实现后续阶段。

工程已存在（Vite + React + TypeScript + 自定义 Tailwind，无 Ant Design / shadcn）。不要重新脚手架，不要混入第二套 UI 库。

**正文与 Cursor / Codex 两侧 skill 保持一致；改流程时两处一起改。**

## 开工检查

1. 读 `AGENTS.md` 开工清单。
2. 读 `CURRENT.md` 的下一刀；用户提示若指定其他切片，以用户为准并准备在收工时更新 CURRENT。
3. 若 CURRENT 明确质量切片或暂缓安排，继续遵守；若未写明下一刀：取 `ROADMAP.md` 未勾选的最早项（当前大项为 **M5**；可选 Tauri 不算默认任务）。
4. 扫 `经验手册.md` 与本次主题相关的条目。
5. 改数据前读 `src/db.ts`、`src/types.ts` 与现有写入路径；改 UI 前读 `design.md`。
6. 本机生产服务与开发服务共用端口，切换按 `docs/部署运维.md`；验证场景见 `docs/验收清单.md`。
7. 验证命令：`pnpm lint`、`pnpm test`、`pnpm build`；界面验收只用 http://127.0.0.1:5173/。

## 按里程碑交付

下表是阶段历史范围，不等同于当前导航；当前为任务（清单/列表/日历）与生活（习惯/看番）等入口。

| 阶段 | 必须交付 | 明确不做 |
|------|----------|----------|
| M1 | 清单/任务 CRUD、子任务/标签/筛选、Dexie 持久化、同步友好 schema | 后端、同步、PWA、日历多视图 |
| M2 | 列表/看板/日历切换、重复任务虚实例、dnd-kit 排序改期 | 番茄钟、账号 |
| M3 | 番茄计时绑定任务、统计图、到期提醒 | 多端同步 |
| M4 | 主题/快捷键/批量、JSON 备份恢复与 CSV 导出、PWA；可选 Tauri | 完整同步协议 |
| M5 | 账号、Supabase 或自建 Node、增量拉取/推送、pending 队列、LWW | CRDT |

## 实现习惯

- 数据写入路径：UI → Zustand（必要时）→ Dexie；刷新后数据仍在。
- 改表结构只走 Dexie version 迁移；偏好类扩展优先 settings + normalize。
- 颜色只引用 `src/index.css` 的 CSS 变量；改 UI 必须浅色 + 深色都看一眼。
- 每完成一个里程碑或切片：能本地运行、能手工验证，再进入下一阶段。

## 用户说「继续开发」时

按开工检查 2→3 执行；不要从 M1 重写；不要忽略 `CURRENT.md` 与 `经验手册.md`。

## 收工检查表

对齐 `AGENTS.md`「收工检查表」：

1. lint / test / build（或记录失败原因）；注明手工验收未做项，不以历史结果代替本轮验证
2. `开发日志.md` 顶部追加一节
3. 更新 `CURRENT.md`
4. 若完成 ROADMAP 项则勾选
5. 有可复用坑则追加 `经验手册.md`
6. 不主动 commit / push
