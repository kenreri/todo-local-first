# 跨 Agent 协作方案

入口为 [AGENTS](AGENTS.md)，下一刀为 [CURRENT](CURRENT.md)，用户本次指令优先。本文件负责文档分工、按需查阅与交接，不重复维护产品约束或整套待办。

## 最短接手路径

1. 每次先读 AGENTS → CURRENT，并检查工作区差异。
2. 从下表选本次任务对应的文档章节与源码，再查经验手册相关条目；首次接手架构时读开发入门导读。
3. 按 AGENTS 完成实施、验证与收工。需要解释“为什么这样设计”时才查对应日志；历史评估用于复现线索，不直接当现存缺陷。

## 按任务查阅

| 本次任务 | 必要文档/经验 | 源码起点（继续追到实际写入） |
| --- | --- | --- |
| 普通续做 | CURRENT 下一刀；[经验索引](经验手册.md#按问题定位) | 用户指定模块或 [架构路径表](开发入门导读.md#2-技术栈与目录) |
| UI / 响应式 / 草稿 | [design 导航](design.md#如何查阅)、[UI 经验](经验手册.md#ui-与交互) | 页面组件、index.css；文字草稿与持久化入口分开核对 |
| 任意数据写入 | AGENTS 数据约束、[数据经验](经验手册.md#数据与备份) | **src/db.ts + src/types.ts**，再追当前业务路径 |
| 任务 / 设置 | [Q4 日志](开发日志.md#2026-11-11--q4-性能交互与集成验收)、评估当前 F06 | TaskDetailPanel / 设置调用组件 → todoStore；设置 → lib/settings；UI反馈 → useSaveFeedback |
| 习惯 / 追番 | [草稿差量经验](经验手册.md#事务保护数据库仍需草稿提交差量) | HabitView / AnimeView → lib/lifePersistence；异步 Bangumi 路径 |
| 工作台 / 附件 | design 工作台与任务交互、数据经验 | WorkspaceView / WorkspaceItemEditor → workspaceUiStore / lib/workspace；useWorkspace / useAttachmentUrl |
| 启动 / 订阅 | [Q2 日志](开发日志.md#2026-11-11--q2-启动与订阅恢复)、评估 F03 | App → todoStore.bootstrap；useWorkspace；restoreGuard 共享锁 |
| 计时 / 恢复 / 备份 | [Q3 日志](开发日志.md#2026-11-11--q3-跨标签计时与恢复运行态边界)、[恢复运维](docs/部署运维.md#回滚与恢复) | pomodoroStore / pomodoroPersistence / pomodoroCoordinator；BackupPanel → restoreBackup → backup / restoreGuard |
| 性能专项 | [已有测量及限制](docs/项目评估.md#质量专项复核与性能证据)，先复测再改 | 当前瓶颈；不因文件长、循环多或有 catch 就重构 |
| 浏览器 / PWA / 服务 | [验收模板](docs/验收清单.md#可复用场景模板)、[部署运维](docs/部署运维.md) | 本机端口与服务状态，独立浏览器配置/测试库 |
| 规划 / 文档整理 | 下方文档职责；ROADMAP相关范围 | 当前源码与现有证据；不顺带实现下一刀业务 |

表内源码名是起点，不是要求通读所有文件；路径与职责详情只在导读维护。质量专项才需全面检查评估/验收，常规小切片只取相关场景。

## 文档职责

| 文件 | 唯一负责的内容 | 何时更新 |
| --- | --- | --- |
| [README](README.md) | 人类使用/运行入口与文档导航 | 使用入口变化 |
| [AGENTS](AGENTS.md) | 硬约束与开工/收工清单 | 开发约束变化 |
| [CURRENT](CURRENT.md) | 当前状态、明确下一刀、阻塞和证据入口 | 每切片结束；保持短，不复制产品史/完整验收 |
| [ROADMAP](ROADMAP.md) | 里程碑完成勾选、尚未实施范围 | 实际交付或计划调整 |
| [开发日志](开发日志.md) | 每切片原因、实现、当时验证、未做边界 | 顶部追加，不改写旧切片 |
| [项目评估](docs/项目评估.md) | 问题判定、复现/关闭证据、性能数据与限制 | 全面评估或具体问题复核 |
| [验收清单](docs/验收清单.md) | 可复用场景模板、逐次执行记录、设备待验项 | 执行相应验收后 |
| [部署运维](docs/部署运维.md) | 服务环境、发布/回滚、数据恢复流程 | 部署或恢复方式变化 |
| [开发入门导读](开发入门导读.md) | 当前架构、模块职责、读写路径、术语 | 架构变化 |
| [design](design.md) | 当前视觉、组件和交互约定 | UI规则变化 |
| [经验手册](经验手册.md) | 可复用症状、原因、避坑动作 | 出现可复用问题；归入对应主题 |

文档冲突先区分职责：约束看 AGENTS，下一刀看 CURRENT，设计看 design，实现事实核对源码；评估和日志必须带日期/版本。历史已完成项不能作为本次通过证据。修正当前说明时保留历史叙事和验证数字，用明确历史标识或补充说明连接到新结论。

## 并行与交接

- 委派前明确目标、文件/代码块所有权、只读或可写，以及主 Agent 的集成责任。共享 store、类型、CSS、进度文档尽量单人持有；相邻改动不能整文件覆盖。
- 子 Agent 返回变更、复现/验证命令、实际结果、证据位置及限制；口头“通过”不替代主 Agent 检查产物与最终集成。
- 任务中途交接时，CURRENT 写清进行中/阻塞；结束交接写下一刀和未完成项，不新增多个重复 TODO 文件。
- 临时日志/截图/脚本可放 `.repo-tools/` / `artifacts/`，它们被忽略且不是 CI。正式回归进入源码测试；交接文档保留必要结论，即使临时文件丢失也能理解。

## 多工具入口与维护

| 工具 | 入口 |
| --- | --- |
| Codex | AGENTS + [.codex skill](.codex/skills/todo-milestone-dev/SKILL.md) |
| Cursor | [overview](.cursor/rules/project-overview.mdc) + [.cursor skill](.cursor/skills/todo-milestone-dev/SKILL.md) |
| Claude Code | [CLAUDE.md](CLAUDE.md) 指向 AGENTS |
| 其他 Agent | AGENTS → CURRENT → 本文按任务查阅 |

双端 milestone skill 正文必须一致，只做路由，不再复制里程碑表与收工规则；overview 保持短摘要。旧日志提到的未跟踪 Cursor 规则不作为接手前提。

文档验收：UTF-8、相对链接/章节锚点、入口一致性、历史标题与勾选保留、命令可执行且不覆盖 dist；验证数量标明本次还是历史。经验条目用“症状 → 原因 → 避坑 → 关联”，不为普通实现硬凑经验。
