# 个人工作台 · Agent 约束

本文件维护硬约束与开工/收工检查。下一刀只看 [CURRENT](CURRENT.md)；按任务选读和文档职责见 [跨 Agent 协作方案](跨Agent协作方案.md)。回复用简体中文，文件保存为 UTF-8。

## 开工清单

1. 读本文件和 `CURRENT.md`，检查 `git status` 与已有差异，保留用户和其他 Agent 的修改。用户指定切片优先；用户说“继续开发”时接 CURRENT，不从 M1 重写。
2. CURRENT 缺失或没有下一刀时，才取 [ROADMAP](ROADMAP.md) 最早未勾选的默认阶段（当前大阶段为 M5）；CURRENT 的质量切片与暂缓安排优先，可选 Tauri 不算。
3. 按 [任务查阅表](跨Agent协作方案.md#按任务查阅) 选择相关文档/源码，并读 [经验手册](经验手册.md#按问题定位) 对应条目。无需每次通读日志、历史评估和整套规划。
4. 改 UI 先读 [design](design.md) 的共同规则与相关组件约定；改数据先读 [db.ts](src/db.ts)、[types.ts](src/types.ts) 和实际调用/写入路径，不能只看 store 的入口。
5. 需要界面时用 `pnpm dev`，浏览器固定 **http://127.0.0.1:5173/**，勿混用 localhost 或换端口。已有生产服务时先按 [部署运维](docs/部署运维.md) 切换，结束恢复原状态；破坏性验收用独立浏览器配置/测试库，不接触日常数据。
6. 执行下方验证；历史通过不作为本次证据。已有失败区分环境、历史与本次改动。

## 产品与范围

- 个人 local-first 工作台：自由收集事情、想法、笔记、链接和本地文件，连接任务、DDL、日历与轻量专注，保留生活与回顾；仅个人使用。
- 主视图为工作台 / 今天 / 任务（清单、列表、日历）/ 生活（习惯、看番）/ 专注 / 回顾。历史 M2 看板不代表当前导航。
- Obsidian / Zotero / VS Code 继续承担专业工作，音乐与陪伴先做轻量功能。工作台文字显式保存、附件即时保存；W1.2 完整行为见 [design](design.md#工作台与任务交互)。
- M1–M4 无业务后端；M5 账号/后端/多端同步、ownerId、pending 队列尚未实施。默认只做当前授权切片，不提前开启后续阶段。
- 不引入 CRDT、Redux、过早后端、Ant Design / shadcn 或新 UI 框架；可选 Tauri 不主动做。
- 全局导航重组、独立资料页、通用块编辑器、OCR、完整沉浸空间/角色成长、专业文献管理及外部工具双向同步继续后置。无明确必要性不升级依赖、搬目录或重写整站。
- 辉光进度环、回顾页 Bento 化、第二套主题等可选体验继续后置；不因整理文档改变原有产品安排。
- 不主动 **commit / push / 发布**；需要用户明确授权。

## 技术栈与验证

React 19 + TypeScript + Vite 8；Zustand；Dexie；自定义 Tailwind 4；History API；FullCalendar；@dnd-kit；Recharts；vite-plugin-pwa。包管理用 pnpm，版本以 package.json/锁文件为准。

```bash
pnpm lint
pnpm test
pnpm build --outDir .repo-tools/validation/build
```

`dist/` 是本机在用生产目录，**验证构建必须独立输出**，不得直接覆盖。pnpm 不在 PATH 时用运维文档中的本机路径；不为验证重新装一套环境。按受影响范围执行 [验收场景](docs/验收清单.md#可复用场景模板)，未做项如实记录；构建成功不等于浏览器或设备验收。

## UI 硬约束

- 唯一色源为 `src/index.css`（`:root` 浅色，`html[data-theme='dark']` 深色），组件引用 CSS token；字阶、间距、圆角、阴影及布局按 design。
- 禁止 `bg-white` / `bg-black` / `text-white`（对应 token 除外）、Tailwind 调色盘色、组件内联 hex/rgb；保留清单色点、优先级边线等语义色例外，优先级等固定语义色仍走 token。
- 主按钮用 `bg-[var(--accent)] text-[var(--on-accent)]` 或对应 `.ui-button-primary`；选中态沿用同一 accent 色系，实底/浅底按控件语义，不随视图变色。
- 新颜色必须同时定义浅深 token；优先复用 `.ui-*`，优先级用 `PriorityBadge` + `--priority-*`，图表/FullCalendar 尽量绑 token。不要给 button 写全局 `color: inherit`。
- 改 UI 必看浅深色的输入、按钮文字、选中态、边框及受影响断点；中文为主，保留英文切换。

## 数据与运行态硬约束

- 普通业务记录用 `crypto.randomUUID()`，带 `createdAt / updatedAt / deletedAt`，日常删除为软删除。`pomodoroRecords` 日常只追加且仅有 `createdAt`；`settings` 固定主键 `app`、带 `updatedAt`。JSON 恢复可在事务中替换集合。
- 表包括 lists、tasks、habits、habitCheckIns、anime、pomodoroRecords、settings、workspaceItems、attachments、attachmentBlobs。附件元数据软删除，字节表按附件 ID 存原始 Blob；日常删除保留字节，不改存临时 URL 或可淘汰缓存。单文件 50 MB、单批 100 MB。
- 修改 schema 仅走 Dexie 递增 `version(n)` + 迁移；偏好扩展优先 normalize，不为开关升版。M5 才补 ownerId；冲突规划仅 LWW，不上 CRDT。
- 读、存活检查、合并/业务计算、写回必须在完整事务内；网络请求在事务外，回来后重读最新记录。`undefined` 不修改，`null` 清空；草稿只提交实际变化。
- 保留任务树关联、集数上限、软删除与重复虚实例规则；禁止物理复制未来重复任务。刷新后数据应仍在。
- 保留 JSON v1–v4 导入兼容、v4 附件完整字节与 CSV 任务导出；CSV 不支持导入，不是完整恢复方式。
- 保留按表订阅及未变化引用复用；判等检查实际字段，不能只比 id/updatedAt。保留失败重试、旧异步回调失效、跨页会话幂等与恢复封写；页内锁不能代替数据库/跨页并发保护。
- 恢复前仍需关闭其他应用页（旧版不参与锁协议）；无 Web Locks 时拒绝危险恢复。未完成的专注不得擅自结算，替换失败必须原子回滚。

## 收工检查表

- [ ] lint / test / 独立 build 通过，或列明失败原因；浏览器/设备验证与未验范围准确。
- [ ] [开发日志](开发日志.md) 顶部追加日期、原因、实现、验证、未做边界；[CURRENT](CURRENT.md) 更新状态和下一刀。
- [ ] 实际完成 ROADMAP 项才勾选；保留历史已勾选叙述。评估/验收/设计/架构只更新相关部分，归属见协作方案。
- [ ] 有可复用坑才追加经验；多 Agent 的文件所有权和集成结果已交接。
- [ ] 未覆盖既有修改、在用 dist 或日常数据；服务恢复到开工状态；未越界开启后续阶段或擅自提交/发布。
