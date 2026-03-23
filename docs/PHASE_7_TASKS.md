# Phase 7 - V4.0 数据模型重构 + 软装清单

始终使用中文回复。
阅读以下 Phase 7 任务卡，按顺序执行 Task 7.1 -> 7.6。每个 Task 完成后执行 `npm run lint && npm run build` 通过再进入下一个。每个 Task 单独 commit。

**重要上下文：HomeStylo 正在从 V3.1 升级到 V4.0。核心变化是：**
1. 顶层实体从 `Scheme`（单次设计方案）变为 `Home`（用户的家）-> `Room` -> `FurnishingPlan`
2. 新增“软装清单”（Furnishing Cart）——预算感知的智能采购管理
3. 渲染管线从七步升级为 Route D 十步管线（后续 Phase 实现）
4. 目标市场从纯中国变为中美同时验证，UI 需要支持中英双语

**本 Phase 的目标：完成数据层重构，让新的 `Home -> Room -> FurnishingPlan` 数据模型跑通。不涉及渲染管线改动。**

---

## Task 7.1 - 重写 AGENTS.md

重写项目根目录的 `AGENTS.md`，更新为 V4.0 的项目定位和架构。
Commit: `phase-7/task-1: rewrite AGENTS.md for V4.0`

## Task 7.2 - 数据库迁移：新增 homes + furnishing_plans + furnishing_plan_items 表

创建迁移文件 `supabase/migrations/v4_home_furnishing.sql`，并新增 `docs/V4_MIGRATION_GUIDE.md`。

Commit: `phase-7/task-2: V4 database migration - homes, rooms, furnishing_plans, furnishing_plan_items`

## Task 7.3 - 更新 TypeScript 类型定义

修改 `src/lib/types/index.ts`，在现有类型之后新增 V4 类型，保留 V3.1 类型不删除。

Commit: `phase-7/task-3: add V4 types - Home, Room, FurnishingPlan, FurnishingPlanItem`

## Task 7.4 - 新建 homeStore + furnishingStore

创建 `src/lib/store/homeStore.ts` 与 `src/lib/store/furnishingStore.ts`。

Commit: `phase-7/task-4: add homeStore and furnishingStore with budget-aware state management`

## Task 7.5 - 预算分配算法 + 单元测试

创建 `src/lib/recommendation/budgetAllocator.ts` 与 `src/lib/recommendation/__tests__/budgetAllocator.test.ts`，运行 `npm run test` 确认通过。

Commit: `phase-7/task-5: budget allocator with weighted category distribution and unit tests`

## Task 7.6 - Home CRUD API 路由

创建 `src/app/api/home/route.ts` 与 `src/app/api/home/[homeId]/route.ts`。

Commit: `phase-7/task-6: Home CRUD API with room and plan eager loading`

---

全部完成后执行 `npm run lint && npm run build && npm run test`，确认无错误，然后 `git push origin main`。
