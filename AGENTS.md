# HomeStylo V2 - Codex Agent Instructions

始终使用中文回复。

## ⚠️ 架构变更：V2 Route F（2026年3月）

**本项目正在从 V1（Route D/E）迁移到 V2（Route F）。** 所有渲染管线代码正在被重写。请严格按照以下 V2 架构原则开发，不要参考旧的 Route D/E 代码。

## Project Overview

HomeStylo 是全球首个"保存用户的家"的 AI 家居决策平台。用户上传房间照片，我们构建它的数字副本，此后每一次家具购买决策，都基于用户真实的家。

核心场景：用户在 Amazon/Wayfair 看中沙发 → Chrome 插件一键"看看放家里" → HomeStylo 在用户照片上生成精确比例的效果图 → 告诉用户"放不放得下"。

目标市场：美国优先（$9.9/月订阅 + Affiliate 佣金），中国做需求验证。

## V2 四条铁律

1. **直接在用户原图上操作，不生成新视角。** 用户看到的底图就是自己拍的照片。
2. **尺寸精确度由几何保证，AI 不决定空间参数。** 家具像素大小由 3D 投影矩阵计算，AI 只在精确 mask 内画家具。
3. **"放不放得下"优先于"好不好看"。** 先出尺寸判断，再出效果图。
4. **功能在用户需要时才出现（渐进式披露）。** 户型图和俯视图是可选高级功能。

## V2 渲染管线（Route F = "Faithful"）

```
用户照片（不变）+ DepthPro 度量深度 + 门高自动校准 → 相机标定
→ 家具 3D 包围盒投影 → 像素级精确 mask
→ FLUX Fill Pro 在 mask 内生成家具（AI 自动匹配透视和光照）
→ 效果图
```

**核心原理变更：不再"贴图后修"，而是让 AI 在精确 mask 内从零生成家具。商品图仅作为 prompt 参考。**

## 精度等级体系

| 等级 | 用户操作 | 精度 | 功能 |
|------|---------|------|------|
| L0 | 上传 1 张照片 | ±5-10% | 效果图、大致比例 |
| L1 | 照片上拖拽家具 | ±5-10% | 位置调整 |
| L2 | 输入墙面宽度 | ±2-3% | 精确比例 |
| L3 | 上传户型图 | ±1-2% | 俯视图、碰撞检测 |

## Tech Stack

- **Framework**: Next.js 16 with App Router, TypeScript, `src/` directory
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Object Storage**: Cloudflare R2
- **Depth Estimation**: Apple DepthPro (`garg-aayush/ml-depth-pro` on Replicate)
- **Effect Image**: FLUX Fill Pro (`black-forest-labs/flux-fill-pro` on Replicate)
- **Quick Edit**: FLUX Kontext Pro (`black-forest-labs/flux-kontext-pro` on Replicate)
- **Background Removal**: Bria (`bria/remove-background` on Replicate)
- **Space Analysis**: Anthropic Claude Vision
- **Deployment**: Vercel

## Core Data Model (V4 — active)

```text
Home (用户的家)
├── Room (房间)[]
│   ├── original_photo_url
│   ├── current_photo_url
│   ├── spatial_analysis (JSONB)
│   ├── depth_raw_url (DepthPro 深度数据)
│   ├── focal_length_px (DepthPro 焦距)
│   ├── camera_calibration (JSONB, 投影矩阵参数)
│   ├── calibration_source ('door'|'ceiling'|'user_wall'|'floorplan')
│   ├── anchor_detection (JSONB, 语义锚点检测结果)
│   └── FurnishingPlan (软装方案)[]
│       ├── total_budget, style_preference
│       ├── FurnishingPlanItem[]
│       │   ├── category, custom_name, custom_image_url
│       │   ├── custom_width/depth/height_mm (家具物理尺寸)
│       │   ├── position_3d (JSONB, 3D 世界坐标)
│       │   ├── position_pixel (JSONB, 在照片中的像素位置)
│       │   ├── fit_status ('confirmed'|'warning'|'blocked')
│       │   ├── product_description (JSONB, Claude Vision 的外观描述)
│       │   └── extracted_image_url (抠图后 PNG)
│       └── EffectImage[]
```

**V3 (scheme-based) 已弃用。** 代码中 schemes/room_analysis/scheme_products 相关逻辑正在被删除。

## Key Modules (V2)

```text
src/lib/spatial/           ← 新建：空间建模（V2 核心）
├── anchorDetector.ts      — Claude Vision 检测门/天花板（尺度锚点）
├── cameraCalibrator.ts    — DepthPro 深度 + 锚点 → 投影矩阵
├── furnitureProjector.ts  — 3D 包围盒 → 像素 mask
├── fitValidator.ts        — 尺寸校验（放不放得下）
└── autoCalibrationPipeline.ts — 上传照片后自动触发全流程

src/lib/generation/        ← 重写：渲染管线
├── routeFPipeline.ts      — Route F 管线编排（替代 routeD/E）
├── fluxFillPro.ts         — FLUX Fill Pro 调用封装
├── promptBuilder.ts       — Route F 的 prompt 构建
├── depthEstimator.ts      — DepthPro 集成（重写）
├── productImagePreprocessor.ts — 商品图抠图（复用）
├── furnitureEraser.ts     — 旧家具擦除（复用）
└── envCheck.ts            — 环境检查（复用）

src/lib/products/          ← 新建：商品图智能处理
└── imageSelector.ts       — Claude Vision 批量分类选图

src/components/room/       ← 新建：交互组件
└── PhotoFurnitureOverlay.tsx — 照片上拖拽家具
```

## Coding Conventions

- TypeScript strict mode
- 始终使用中文回复和注释
- Mobile-first responsive design
- File names kebab-case, components PascalCase
- `'use client'` only when needed, prefer Server Components
- Tailwind CSS + shadcn/ui, no custom CSS files
- Zustand for client state, Supabase for persistence
- API routes return `{ success: boolean, data?: any, error?: string }`
- Git commit format: `v2/phase-X/task-Y: brief description`
- 每个 Task 完成后执行 `npm run lint && npm run build` 确认通过

## 已删除的模块（不要引用）

以下文件已在 V2 迁移中删除，不要 import 或引用：
- routeDPipeline.ts, routeEPipeline.ts
- compositeEngine.ts, compositeEngineRouteE.ts
- edgeMaskGenerator.ts, inverseMaskGenerator.ts
- fluxInpainter.ts, fluxFillRefiner.ts, fluxRenderer.ts
- multiItemRenderer.ts, scaleCalculator.ts, scaleCalculatorRouteE.ts
- viewAngleMatcher.ts, icLightRefiner.ts, hotspotDetector.ts

## 可复用的模块

以下模块可以直接使用：
- `src/lib/api/r2.ts` — R2 上传
- `src/lib/api/replicate.ts` — Replicate 调用封装（含重试、fallback）
- `src/lib/api/claude.ts` — Claude Vision 调用
- `src/lib/supabase/` — Supabase 客户端
- `src/lib/utils/jsonExtractor.ts` — JSON 解析工具
- `src/lib/generation/productImagePreprocessor.ts` — 商品图抠图
- `src/lib/generation/furnitureEraser.ts` — 旧家具擦除
- `src/lib/generation/envCheck.ts` — 环境变量检查
- `src/app/api/home/` — Home CRUD
- `src/app/api/room/[roomId]/route.ts` — Room CRUD
- `src/app/api/room/[roomId]/upload/route.ts` — 照片上传
- `src/app/api/furnishing/` — Plan + Item CRUD
