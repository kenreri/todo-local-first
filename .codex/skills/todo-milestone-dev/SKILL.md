---
name: todo-milestone-dev
description: Develop and maintain this repository's local-first personal workspace, including milestone slices and quality fixes. Use for 继续开发, 清单开发, M1–M5, tasks, workspace, Dexie, pomodoro, PWA, or repository workflow updates; follow the user's current scope.
---

# 个人工作台 · 切片开发

所有路径相对于仓库根目录 `/home/lx/kenreri/todo-list`；跨环境使用当前仓库根，不依赖本机工具目录存在。

1. 读根目录 `AGENTS.md` 与 `CURRENT.md`，检查已有差异。用户指定切片优先；“继续开发”接下一刀，不重新搭建项目。
2. 按 `跨Agent协作方案.md` 的“按任务查阅”选择必要章节和源码，读 `经验手册.md` 对应条目。只在 CURRENT 缺失/无下一刀时按 AGENTS 的 ROADMAP 回退规则选择任务。
3. 改 UI 读 `design.md`，改数据读 `src/db.ts`、`src/types.ts` 和实际读写链；用当前源码核对历史评估，不重复修已关闭问题。
4. 按 AGENTS 的验证和收工清单交付。验证构建独立输出，不覆盖在用 dist；浏览器/服务切换按 `docs/部署运维.md`，验收选 `docs/验收清单.md` 对应场景。

本技能只作入口，不另维护产品边界、里程碑表或验证数量。Codex/Cursor两份正文同步；不因应用技能扩大用户授权，未经明确要求不commit/push/发布。
