# Phase 1 — 核心渲染闭环（Route F 最小管线）

始终使用中文回复。

阅读以下 Phase 1 任务卡，按顺序执行 Task 1.1 → 1.12。每个 Task 完成后执行 `npm run lint && npm run build` 通过再进入下一个。每个 Task 单独 commit。

**本 Phase 的目标：用户上传 1 张房间照片 + 手动添加 1 件家具（图片+尺寸）→ 系统自动完成空间分析和相机标定 → 生成像素级尺寸精确的效果图。这是 HomeStylo V2 的最小可用产品。**

**核心架构变更：废弃 Route D/E 的"先贴图后修"路线，改为 Route F"在用户原图上用精确 mask 做 inpainting"。家具不再被贴到画面里，而是由 AI 在精确的 3D 投影 mask 区域内从零生成。**

**前置条件：**
- Replicate API Token 可用
- Anthropic API Key 可用（Claude Vision）
- Cloudflare R2 配置正常
- Supabase 配置正常

---

## Task 1.1 — 删除 V3 代码

清理所有 V3（scheme-based）相关代码。V4（home/room/plan-based）全部保留。

**删除的文件：**

API 路由：
- `src/app/api/room/analyze/route.ts`（V3 旧分析 API，注意保留 `src/app/api/room/[roomId]/analyze/route.ts`）
- `src/app/api/product/select/route.ts`
- `src/app/api/share/create/route.ts`
- `src/app/api/payment/confirm/route.ts`
- `src/app/api/payment/create-order/route.ts`

渲染管线（全部删除）：
- `src/lib/generation/routeDPipeline.ts`
- `src/lib/generation/routeEPipeline.ts`
- `src/lib/generation/compositeEngine.ts`
- `src/lib/generation/compositeEngineRouteE.ts`
- `src/lib/generation/edgeMaskGenerator.ts`
- `src/lib/generation/inverseMaskGenerator.ts`
- `src/lib/generation/fluxInpainter.ts`
- `src/lib/generation/fluxFillRefiner.ts`
- `src/lib/generation/fluxRenderer.ts`
- `src/lib/generation/multiItemRenderer.ts`
- `src/lib/generation/scaleCalculator.ts`
- `src/lib/generation/scaleCalculatorRouteE.ts`
- `src/lib/generation/viewAngleMatcher.ts`
- `src/lib/generation/icLightRefiner.ts`
- `src/lib/generation/hotspotDetector.ts`
- `src/lib/generation/__tests__/scaleCalculator.test.ts`

**保留的文件：**
- `src/lib/generation/productImagePreprocessor.ts` ✅
- `src/lib/generation/furnitureEraser.ts` ✅
- `src/lib/generation/depthEstimator.ts`（Task 1.3 会重写）
- `src/lib/generation/promptBuilder.ts`（Task 1.10 会重写）
- `src/lib/generation/envCheck.ts` ✅

**同时清理：**
- `src/app/api/generate/effect-image/route.ts` 中删除 `runLegacySchemePipeline` 函数和所有 `scheme_id` 相关逻辑。删除 `runRouteDPipeline` 和 `runRouteEPipeline` 的 import。暂时让 `planId` 路径返回 `{ success: false, error: "Route F pipeline not yet implemented" }`。
- 在 `src/lib/types/index.ts` 中，**不要**删除 V3 类型定义（Scheme, RoomAnalysis 等），因为数据库表还在——只是新代码不再引用它们。
- 检查所有 `import` 是否有引用已删除文件的，全部清理。

Commit: `v2/phase-1/task-1: remove V3 code and Route D/E pipeline`

---

## Task 1.2 — 数据库 Migration

创建 `supabase/migrations/v2_phase1_spatial.sql`：

```sql
-- ============================================
-- V2 Phase 1: Spatial calibration fields
-- ============================================

-- rooms 表扩展
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS depth_raw_url TEXT,
  ADD COLUMN IF NOT EXISTS focal_length_px NUMERIC,
  ADD COLUMN IF NOT EXISTS camera_calibration JSONB,
  ADD COLUMN IF NOT EXISTS calibration_source TEXT
    CHECK (calibration_source IN ('door', 'ceiling', 'user_wall', 'floorplan')),
  ADD COLUMN IF NOT EXISTS calibration_accuracy NUMERIC,
  ADD COLUMN IF NOT EXISTS anchor_detection JSONB;

-- furnishing_plan_items 表扩展
ALTER TABLE public.furnishing_plan_items
  ADD COLUMN IF NOT EXISTS position_3d JSONB,
  ADD COLUMN IF NOT EXISTS position_pixel JSONB,
  ADD COLUMN IF NOT EXISTS rotation_y NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_description JSONB,
  ADD COLUMN IF NOT EXISTS extracted_image_url TEXT,
  ADD COLUMN IF NOT EXISTS candidate_image_urls JSONB;
```

同时在 `src/lib/types/index.ts` 底部追加 V2 新增类型：

```typescript
// ============================================
// V2.0 Types - Spatial calibration + Route F
// ============================================

export type AccuracyLevel = "L0" | "L1" | "L2" | "L3";
export type CalibrationSource = "door" | "ceiling" | "user_wall" | "floorplan";

export interface Vec2px { x: number; y: number; }
export interface Vec3mm { x: number; y: number; z: number; }

export interface SemanticAnchor {
  type: "door" | "ceiling_height" | "floor_tile" | "window" | "baseboard";
  pixelBounds: { topLeft: Vec2px; bottomRight: Vec2px };
  knownSizeMm: number;
  measureDirection: "vertical" | "horizontal";
  confidence: number;
}

export interface AnchorDetectionResult {
  anchors: SemanticAnchor[];
  bestAnchor: SemanticAnchor | null;
  roomFeatures: {
    wallColor: string | null;
    floorMaterial: string | null;
    lightingDirection: string | null;
    existingFurniture: ExistingFurniture[];
    shootingDirection: string | null;
  };
}

export interface CameraCalibrationData {
  K: number[][];
  scaleFactor: number;
  focalLengthPx: number;
  imageWidth: number;
  imageHeight: number;
  calibrationSource: CalibrationSource;
  estimatedAccuracy: number;
  fovYDeg: number;
}

export interface FurniturePixelPosition {
  x: number; y: number;
  width: number; height: number;
}

export interface FurnitureBBox3D {
  center: Vec3mm;
  width: number;
  depth: number;
  height: number;
  rotationY: number;
}

export interface ProjectionResult {
  maskBuffer: Buffer;
  boundingRect: FurniturePixelPosition;
  wallWidthPercent: number;
  isClipped: boolean;
}
```

Commit: `v2/phase-1/task-2: database migration and V2 type definitions`

---

## Task 1.3 — DepthPro 集成

重写 `src/lib/generation/depthEstimator.ts`：

替换现有的深度估计模型为 Apple DepthPro（Replicate: `garg-aayush/ml-depth-pro`）。

**关键变更：** DepthPro 同时输出度量深度图和焦距估计，这是相机标定的基础。

```typescript
import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface DepthEstimationResult {
  /** 深度图可视化 URL（用于调试和展示） */
  depthImageUrl: string;
  /** 原始深度数据 URL（Float32 或 PNG 灰度，用于计算） */
  depthRawUrl: string;
  /** DepthPro 估计的焦距（像素） */
  focalLengthPx: number | null;
  /** 使用的模型 */
  model: string;
  /** 处理时间 */
  processingTimeMs: number;
}

export async function estimateDepthWithPro(
  imageUrl: string,
  options: { timeout?: number; planId?: string },
): Promise<DepthEstimationResult>;
```

**实现注意事项：**
- Replicate 上的 `garg-aayush/ml-depth-pro` 可能只输出可视化 PNG 而非 raw depth。
- 检查 output 格式：如果是单个 URL → 可视化 PNG；如果是对象 → 可能有 depth + focal_length 字段。
- 如果无法获取 raw depth 或 focal_length，**fallback 策略**：
  - 用可视化 PNG 作为近似深度图（灰度值 0-255 映射到近-远）
  - focal_length 用默认值估算：`focalLengthPx = imageWidth * 1.2`（典型手机相机）
  - 记录 log 标注这是 fallback 值
- 备选模型：`cjwbw/zoedepth`（输出度量深度，但不输出焦距）

将结果上传到 R2 并返回 URL。同时将 `focal_length_px` 和 `depth_raw_url` 存入 room 记录。

Commit: `v2/phase-1/task-3: DepthPro integration with focal length estimation`

---

## Task 1.4 — 语义锚点检测模块

创建 `src/lib/spatial/anchorDetector.ts`：

用 Claude Vision 从实拍照片中自动检测可用于尺度校准的参考物体。

**核心功能：** 检测门、天花板线等已知物理尺寸的物体，同时提取房间视觉特征。

使用现有的 `src/lib/api/claude.ts` 中的 `analyzeImage` 函数调用 Claude Vision。

**Claude Vision prompt（必须严格使用以下 prompt）：**

```
Analyze this indoor room photo. Perform two tasks:

TASK 1: Detect scale reference objects (in priority order):
1. Interior door: Mark the four corner pixel coordinates of the door frame. Standard Chinese interior door height is 2050mm, width 800mm.
2. Ceiling-floor distance: If both ceiling line and floor line are visible, mark their y-coordinates. Standard Chinese residential ceiling height is 2700mm.
3. Floor tiles: If tile seams are visible, mark four corners of one complete tile. Common sizes: 800x800mm or 600x600mm.

For each detected anchor, provide pixel coordinates of the bounding box and a confidence score (0-1).

TASK 2: Identify room features:
- Wall color (e.g., "warm beige", "cool white", "light gray")
- Floor material (e.g., "oak hardwood", "gray tile", "marble", "carpet")
- Primary lighting direction (e.g., "natural light from right window", "overhead ceiling light")
- Existing furniture: list each piece with category, approximate pixel position (x,y as 0-1 normalized), and estimated width in pixels
- Shooting direction (e.g., "from entrance looking into living room")

Output strict JSON only:
{
  "anchors": [
    {
      "type": "door",
      "pixelBounds": { "topLeft": {"x": 120, "y": 80}, "bottomRight": {"x": 210, "y": 580} },
      "knownSizeMm": 2050,
      "measureDirection": "vertical",
      "confidence": 0.9
    }
  ],
  "roomFeatures": {
    "wallColor": "warm beige",
    "floorMaterial": "oak hardwood",
    "lightingDirection": "natural light from large right-side window",
    "existingFurniture": [
      { "id": "existing_1", "category": "sofa", "position": {"x": 0.5, "y": 0.6}, "estimated_width_mm": 2200, "estimated_depth_mm": 900 }
    ],
    "shootingDirection": "from entrance looking into living room"
  }
}

If you cannot detect any anchor, set "anchors" to an empty array. Do not guess.
```

**解析逻辑：** 复用 `src/lib/utils/jsonExtractor.ts` 的 `extractJson` 函数解析 Claude 返回的 JSON。

**选择最佳锚点：** 按 confidence 排序，取最高的。如果没有任何锚点（anchors 为空），返回 `bestAnchor: null`。

**结果同时写入 `rooms.anchor_detection` 和更新 `rooms.spatial_analysis`**（将 roomFeatures 合并到现有 spatial_analysis 格式中）。

Commit: `v2/phase-1/task-4: semantic anchor detection with Claude Vision`

---

## Task 1.5 — 相机标定模块（L0）

创建 `src/lib/spatial/cameraCalibrator.ts`：

从 DepthPro 的深度图 + 焦距 + 语义锚点，计算完整的相机投影矩阵。

```typescript
import "server-only";

import sharp from "sharp";

export interface CameraCalibration {
  K: number[][];
  scaleFactor: number;
  focalLengthPx: number;
  imageWidth: number;
  imageHeight: number;
  calibrationSource: CalibrationSource;
  estimatedAccuracy: number;
  fovYDeg: number;
}

/**
 * L0 标定：从语义锚点（门高/天花板）自动校准。
 * 
 * 算法：
 * 1. 构建内参矩阵 K = [[f, 0, W/2], [0, f, H/2], [0, 0, 1]]
 * 2. 读取锚点两端的深度值 d1, d2
 * 3. 反投影到 3D: P = ((px - cx) * d / f, (py - cy) * d / f, d)
 * 4. 计算 3D 距离 vs 已知物理距离 → scaleFactor
 * 5. 计算 fovYDeg = 2 * atan(H / (2 * f)) * 180 / PI
 */
export function calibrateFromAnchor(
  depthImageUrl: string,     // 深度图 URL（灰度 PNG）
  focalLengthPx: number,
  imageWidth: number,
  imageHeight: number,
  anchor: SemanticAnchor,
): Promise<CameraCalibration>;
```

**深度图读取：** 
- 下载深度图 PNG → Sharp 转灰度 → 提取 raw buffer
- 灰度值 0-255 映射到深度（如果是可视化 PNG：0=近, 255=远）
- 对锚点区域采样：取锚点端点附近 3×3 区域的平均深度值（避免噪声）

**scaleFactor 计算：**
- 对于门（vertical anchor）：反投影门框顶部和底部像素到 3D → 计算 3D 距离 → `scaleFactor = 2050 / (3D距离 * 1000)`
- 所有深度值乘以 scaleFactor 得到校准后的真实距离

**投影/反投影函数：**
```typescript
// 返回的 CameraCalibration 对象需要附带这两个方法
// （可以用闭包或 class 实现）

/** 3D 世界坐标（mm）→ 像素坐标 */
function projectToPixel(point3d: Vec3mm): Vec2px | null {
  const Z = point3d.z / 1000; // mm → m
  if (Math.abs(Z) < 1e-6) return null;
  const px = focalLengthPx * (point3d.x / 1000) / Z + cx;
  const py = focalLengthPx * (point3d.y / 1000) / Z + cy;
  return { x: Math.round(px), y: Math.round(py) };
}

/** 像素坐标 + 深度（米）→ 3D 世界坐标（mm） */
function backprojectToWorld(px: number, py: number, depthMeters: number): Vec3mm {
  const d = depthMeters * scaleFactor;
  return {
    x: (px - cx) * d / focalLengthPx * 1000,
    y: (py - cy) * d / focalLengthPx * 1000,
    z: d * 1000,
  };
}
```

**如果没有锚点（bestAnchor 为 null）：** 使用默认校准——假设房间深度 4 米，给出粗略估计。标记 `estimatedAccuracy: 0.2`（±20%）。仍然返回有效的 CameraCalibration，让流程继续。

**结果序列化后存入 `rooms.camera_calibration`。** 注意：投影/反投影函数无法序列化，所以 DB 中只存参数（K, scaleFactor, focalLengthPx 等），使用时从参数重建函数。

创建辅助函数 `rebuildCalibration(data: CameraCalibrationData): CameraCalibration` 从 DB 数据重建完整对象。

Commit: `v2/phase-1/task-5: camera calibration from semantic anchors`

---

## Task 1.6 — 自动标定流程（上传触发）

修改 `src/app/api/room/[roomId]/upload/route.ts`：

在照片上传成功后，自动触发完整的标定流程。

**在现有 upload 逻辑的末尾追加（仅当 uploadType === "photo" 时）：**

```typescript
// 异步触发标定流程（不阻塞上传响应）
if (uploadType === "photo") {
  // 使用 Next.js 的 after() 或 void promise
  void runAutoCalibration(roomId, imageUrl);
}
```

创建 `src/lib/spatial/autoCalibrationPipeline.ts`：

```typescript
/**
 * 自动标定管线：upload → DepthPro → 锚点检测 → 相机标定
 * 
 * 全自动，用户零操作。结果写入 rooms 表。
 */
export async function runAutoCalibration(roomId: string, imageUrl: string): Promise<void> {
  // Step 1: DepthPro 深度估计
  // → 存 depth_raw_url, focal_length_px 到 rooms 表
  
  // Step 2: Claude Vision 语义锚点检测
  // → 存 anchor_detection, 更新 spatial_analysis 到 rooms 表
  
  // Step 3: 相机标定
  // → 存 camera_calibration, calibration_source, calibration_accuracy 到 rooms 表
  
  // 每一步都 try-catch，失败不阻塞后续步骤
  // 即使全部失败，用户仍然可以手动添加家具并生成效果图（用 fallback 校准）
}
```

Commit: `v2/phase-1/task-6: auto-calibration pipeline triggered on photo upload`

---

## Task 1.7 — 家具 3D 投影 + Mask 生成

创建 `src/lib/spatial/furnitureProjector.ts`：

将家具的 3D 包围盒通过相机投影矩阵投影到用户照片上，生成像素级精确的 mask。

```typescript
import "server-only";

import sharp from "sharp";

/**
 * 将家具 3D 包围盒的 8 个顶点投影到 2D，取 bounding rect。
 * 在 bounding rect 区域生成白色 mask（白色=需要生成家具的区域）。
 * 
 * 包围盒 8 个顶点：
 * center ± (width/2, height/2, depth/2)，考虑 rotationY 旋转
 */
export function projectFurnitureMask(
  calibration: CameraCalibration,
  furniture: FurnitureBBox3D,
  imageWidth: number,
  imageHeight: number,
): ProjectionResult;

/**
 * 批量投影多件家具，合并为一张 mask。
 */
export function projectMultipleFurniture(
  calibration: CameraCalibration,
  furniture: FurnitureBBox3D[],
  imageWidth: number,
  imageHeight: number,
): {
  combinedMaskBuffer: Buffer;
  individualResults: ProjectionResult[];
};

/**
 * 像素坐标 → 地面上的 3D 点（用于拖拽后反投影）。
 * 假设家具放在地面上（y=0 平面），从像素射线与地面求交。
 */
export function backprojectPixelToFloor(
  calibration: CameraCalibration,
  depthMap: Buffer,     // 灰度深度图
  depthWidth: number,
  depthHeight: number,
  pixelX: number,
  pixelY: number,
): Vec3mm;
```

**mask 生成实现：**
1. 计算家具包围盒的 8 个 3D 顶点（考虑 rotationY）
2. 用 `calibration.projectToPixel` 投影每个顶点到 2D
3. 取所有投影点的 bounding rect
4. 用 Sharp 创建一张全黑图（与用户照片同尺寸）
5. 在 bounding rect 区域画白色矩形
6. 可选：用投影的四边形顶点画更精确的凸多边形（而非矩形），但 MVP 用矩形即可
7. mask 输出为 PNG Buffer

**家具默认放置位置：**
如果 item 没有 position_3d，根据 category 分配默认位置：
```typescript
const DEFAULT_POSITIONS: Record<string, Vec3mm> = {
  sofa: { x: 0, y: 0, z: 2000 },        // 房间中央偏后
  coffee_table: { x: 0, y: 0, z: 2500 }, // 沙发前方
  tv_cabinet: { x: 0, y: 0, z: 500 },    // 靠近对面墙
  // ... 其他品类
};
```
这里的坐标系：x=左右（mm），y=上下（mm, 0=地面），z=深度（mm, 0=相机位置）。

Commit: `v2/phase-1/task-7: furniture 3D projection and mask generation`

---

## Task 1.8 — Route F 渲染管线（简化版）

创建 `src/lib/generation/routeFPipeline.ts`：

Phase 1 简化版：只处理单件家具，不含旧家具擦除。

```typescript
import "server-only";

/**
 * Route F 渲染管线 — "Faithful" 管线
 * 
 * 核心原理：在用户原图上，用精确的 3D 投影 mask 指定家具位置，
 * 让 FLUX Fill Pro 在 mask 区域内从零生成家具。
 * 家具的尺寸由数学保证，外观由 AI 在原图上下文中匹配。
 */
export async function runRouteFPipeline(
  effectImageId: string,
  planId: string,
): Promise<void> {
  // Step 0: 数据加载
  //   读取 plan → room → items
  //   读取 room.camera_calibration（如果没有，触发标定或用 fallback）
  //   读取 room 照片
  
  // Step 1: 商品图处理
  //   对每件家具调用 productImagePreprocessor（分类+抠图）
  //   用 Claude Vision 生成家具外观描述（用于 prompt）
  //   — 如果只有1件家具（Phase 1），直接处理
  
  // Step 2: 3D 投影生成 mask
  //   从 item 的 position_3d + 尺寸构建 FurnitureBBox3D
  //   通过 calibration 投影 → mask PNG
  //   上传 mask 到 R2
  
  // Step 3: 构建 prompt
  //   房间描述（wallColor, floorMaterial, lightingDirection）
  //   + 家具描述（Claude Vision 对商品图的分析）
  //   + 渲染关键词（photorealistic, matching room lighting, natural shadows）
  
  // Step 4: FLUX Fill Pro 生成
  //   输入：用户照片（原图）+ mask + prompt
  //   FLUX Fill Pro 在白色 mask 区域生成家具
  //   下载结果，上传到 R2
  
  // Step 5: 保存结果
  //   更新 effect_images 表：image_url, generation_status="done"
  //   保存 generation_params（包含 mask URL, prompt, model 等调试信息）
}
```

**进度更新：** 复用现有 `updateEffectProgress` 模式。Route F 的 stages：
- `"analyzing"` — 空间分析/标定
- `"preparing"` — 商品图处理+投影计算
- `"generating"` — FLUX Fill Pro 渲染中
- `"done"` — 完成

**错误处理：** 每步 try-catch，失败写入 `error_message`，设 `generation_status = "failed"`。

Commit: `v2/phase-1/task-8: Route F pipeline (simplified, single item)`

---

## Task 1.9 — FLUX Fill Pro 调用封装

创建 `src/lib/generation/fluxFillPro.ts`：

**这是 Route F 的核心渲染步骤。** 调用 FLUX Fill Pro 在精确 mask 区域内生成家具。

```typescript
import "server-only";

import { runPredictionWithRetry } from "@/lib/api/replicate";
import { uploadToR2 } from "@/lib/api/r2";

export interface FluxFillProOptions {
  /** 用户房间照片 URL（底图） */
  imageUrl: string;
  /** mask URL（白色=生成家具的区域，黑色=保留原图） */
  maskUrl: string;
  /** 家具+场景描述 prompt */
  prompt: string;
  /** guidance scale，默认 3.5 */
  guidance?: number;
  /** 生成步数，默认 50 */
  steps?: number;
  /** 用于 R2 存储路径 */
  planId: string;
  /** 超时ms */
  timeout?: number;
}

export interface FluxFillProResult {
  imageUrl: string;
  model: string;
  processingTimeMs: number;
}

export async function generateWithFluxFillPro(
  options: FluxFillProOptions,
): Promise<FluxFillProResult>;
```

**Replicate 模型参数：**
```
model: "black-forest-labs/flux-fill-pro"
input: {
  image: options.imageUrl,
  mask: options.maskUrl,
  prompt: options.prompt,
  guidance: 3.5,        // FLUX Fill Pro 最佳范围 2-5
  steps: 50,
  safety_tolerance: 4,
  prompt_upsampling: false,
  output_format: "png"
}
```

**Fallback：** `black-forest-labs/flux-fill-dev`

**输出处理：** 复用 `fluxFillRefiner.ts` 中的 `extractOutputCandidate` 和 `downloadModelImage` 模式（这些是通用的 Replicate 输出解析逻辑，在删除文件前先把这些工具函数提取到 `src/lib/api/replicateUtils.ts`）。

Commit: `v2/phase-1/task-9: FLUX Fill Pro rendering module`

---

## Task 1.10 — Prompt 构建器（Route F 版）

重写 `src/lib/generation/promptBuilder.ts`：

保留 `buildFluxPrompt` 和 `buildNegativePrompt`（可能还有其他代码引用），新增 Route F 专用函数。

```typescript
/**
 * Route F prompt 策略：
 * 
 * 不再描述"整个房间应该长什么样"（那是 Route E 的做法）。
 * 而是描述"在这个 mask 区域内应该画什么家具"。
 * 
 * FLUX Fill Pro 的 inpainting 机制会自动从 mask 外的像素上下文中
 * 推断光照方向、透视角度、环境色调，所以 prompt 只需要描述家具本身。
 */
export function buildRouteFPrompt(params: {
  /** 家具外观描述（来自 Claude Vision 对商品图的分析） */
  furnitureDescription: string;
  /** 家具品类 */
  category: string;
  /** 房间特征 */
  roomDescription: string;
  lightingDirection: string;
  /** 风格偏好（可选） */
  stylePreference?: string;
}): string {
  // 示例输出：
  // "A modern gray fabric L-shaped sectional sofa with wooden legs,
  //  sitting on oak hardwood floor, warm beige walls,
  //  natural light from right window casting soft shadows,
  //  photorealistic interior photography, matching room ambient lighting,
  //  no people, no text, no watermark"
}
```

同时新增一个**家具外观描述生成函数**：
```typescript
/**
 * 用 Claude Vision 分析商品图，生成用于 prompt 的外观描述。
 */
export async function describeProductImage(
  imageUrl: string,
  productName: string,
  category: string,
): Promise<string>;
```

Claude Vision prompt：
```
Describe this furniture product image for AI rendering.
Product: {productName} (Category: {category})

Provide a concise visual description covering:
- Color and material (e.g., "dark gray linen fabric", "walnut solid wood")
- Shape and form (e.g., "L-shaped sectional", "round pedestal")
- Style (e.g., "mid-century modern", "Scandinavian minimalist")
- Notable features (e.g., "tapered wooden legs", "tufted cushions", "chrome frame")

Output a single paragraph, 20-40 words. Use only visual attributes.
Do not mention brand names, prices, or dimensions.
```

Commit: `v2/phase-1/task-10: Route F prompt builder with product description`

---

## Task 1.11 — 效果图展示页（简化版）

重写效果图展示相关页面和组件。

**修改 `src/app/api/generate/effect-image/route.ts`：**
- 删除 Task 1.1 中留的占位符
- 接入 `runRouteFPipeline`
- 只支持 `plan_id` 路径（不再支持 `scheme_id`）

**修改或创建效果图生成页面 `src/app/generate/[planId]/page.tsx`：**
- 页面加载时 POST `/api/generate/effect-image` with `{ plan_id: planId }`
- 轮询 `/api/generate/status?plan_id=xxx` 检查进度
- 显示进度状态（analyzing → preparing → generating → done）
- 完成后显示效果图
- "返回软装清单" 按钮

**进度文案：**
- analyzing: "正在分析你的房间空间..."
- preparing: "正在准备家具渲染..."
- generating: "AI 正在将家具放入你的房间..."
- done: "完成！"

Commit: `v2/phase-1/task-11: effect image generation page with Route F`

---

## Task 1.12 — 手动添加家具入口

确保 `src/app/api/furnishing/item/route.ts` 的 POST 接口支持以下字段：

```typescript
{
  plan_id: string;
  category: string;
  custom_name: string;
  custom_image_url: string;      // 粘贴商品图片 URL
  custom_width_mm: number;
  custom_depth_mm: number;
  custom_height_mm: number;
  price?: number;
  custom_source_url?: string;    // 商品链接
  source: "user_uploaded";
}
```

如果现有接口已经支持，只需确认无 bug。如果缺少字段，补上。

在软装清单页面（`/furnishing/[planId]`）确保"添加商品"对话框可用：
- 输入：商品名称、品类（下拉选择）、图片 URL、尺寸（宽×深×高 mm）、价格
- 提交后调用 POST API
- 刷新列表

Commit: `v2/phase-1/task-12: manual furniture add entry with dimensions`

---

## Phase 1 完成后的验收测试

1. 上传一张客厅实拍照片
2. 查看 rooms 表：应有 `depth_raw_url`、`focal_length_px`、`anchor_detection`、`camera_calibration` 字段被填充
3. 手动添加一件沙发：名称="灰色布艺沙发"，图片=任意白底沙发图URL，尺寸=2600×900×850mm
4. 点击"生成效果图"
5. 等待 30-60 秒
6. 查看效果图：沙发应该出现在用户照片中，按真实比例渲染
7. 查看 `effect_images` 表的 `generation_params`：应有 mask URL、prompt、model 等信息

**如果效果图中沙发的位置或大小明显不对：** 检查 `camera_calibration` 的 `estimatedAccuracy`。如果是 fallback 校准（accuracy > 0.15），说明锚点检测失败了，这是预期的——Phase 2 会添加 L2 手动校准。

全部完成后 `npm run lint && npm run build`，确认无错误，然后 `git push origin main`。

---

*Phase 1 完成后，进入 Phase 2：Chrome 插件 + 多件渲染 + 照片上拖拽交互。*
