# Phase 8 - Room API + Furnishing Plan API + 软装清单 UI

始终使用中文回复。

按顺序执行 Task 8.1 -> 8.6。每个 Task 完成后执行 `npm run lint && npm run build`，Task 8.3 额外执行 `npm run test`。全部完成后执行 `npm run lint && npm run build && npm run test`，然后 `git push origin main`。

## 目标

完成 Room 和 Furnishing Plan 的 CRUD API，以及软装清单（Furnishing Cart）的前端 UI。Phase 完成后，用户可以跑通：

`Home -> Room -> FurnishingPlan -> Furnishing Cart`

## Task 8.1

- 新增 Room CRUD API
- 同步本任务卡到 `docs/PHASE_8_TASKS.md`
- Commit: `phase-8/task-1: Room CRUD API with ownership verification`

## Task 8.2

- 新增 Furnishing Plan CRUD API
- Commit: `phase-8/task-2: Furnishing Plan CRUD API with item eager loading`

## Task 8.3

- 新增 Furnishing Plan Item API
- 新增预算调整 API，复用 `allocateBudget()`
- Commit: `phase-8/task-3: Furnishing Plan Items API + budget adjustment with allocator integration`

## Task 8.4

- 新增 `/furnishing/[planId]` 软装清单页
- 补最小入口：`/dashboard` Home 列表、`/home/[homeId]` Room 列表
- Commit: `phase-8/task-4: Furnishing Cart page with budget control, item list, and status management`

## Task 8.5

- 新增 `BudgetSlider` 预算滑块组件
- Commit: `phase-8/task-5: BudgetSlider component with real-time feedback and over-budget warning`

## Task 8.6

- 新增 `PurchaseProgress` 和 `ShareCard`
- 集成进 `/furnishing/[planId]`
- Commit: `phase-8/task-6: PurchaseProgress bar and ShareCard components for furnishing plan`

## 备注

- 需要先在 Supabase 执行 `supabase/migrations/v4_home_furnishing.sql`
- 本阶段保留 V3.1 旧页面与旧 API，不做删除
