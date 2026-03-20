# Phase 3 Task Cards — 效果图渲染管线

> **核心目标：从用户实拍照生成保持空间比例的风格化效果图。**
>
> 技术路线（基于2025-2026 SOTA调研）：
> - 深度估计：Apple DepthPro（零配置度量深度，0.3s，不需要相机参数）
> - 渲染引擎：FLUX.1 Dev + ControlNet Depth（深度条件控制，保持空间结构）
> - 分割：SAM 2（家具区域识别，为Phase 4替换做准备）
> - 热点：Claude Vision（识别渲染图中家具位置坐标）
>
> **管线流程：**
> ```
> 用户实拍照 → DepthPro深度图 → FLUX Depth ControlNet渲染 → Claude Vision热点标注 → 存R2
> ```
>
> **不做的事（Phase 3边界）：**
> - 不做视角匹配（从标准角度生成，不试图对齐用户拍照角度）
> - 不做家具替换（Phase 4）
> - 不做质量评分+自动重生成（上线后根据数据优化）
> - 不做3D模型渲染（用2D diffusion方案）
>
> **执行顺序：Task 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6**
> 始终使用中文回复。

---

## Task 3.1 — 深度估计模块（DepthPro via Replicate）

**从用户实拍照提取度量深度图。这是空间准确性的技术基础。**

**技术选型说明：**
- DepthPro（Apple，ICLR 2025）：零配置输出真实距离（米），不需要相机内参，0.3s/张
- 备选：Depth Anything V2（相对深度，视觉更平滑但无绝对距离）
- Replicate上的模型ID需要在实现时确认最新可用版本

**交给 Codex 的 prompt：**

```
创建深度估计模块 /src/lib/generation/depthEstimator.ts。

=== 功能 ===

接收一张图片URL，调用Replicate上的深度估计模型，返回深度图URL。

=== 接口 ===

export interface DepthEstimationResult {
  depthImageUrl: string;       // 深度图的URL（已上传R2）
  model: string;               // 使用的模型标识
  processingTimeMs: number;    // 处理耗时
}

export async function estimateDepth(
  imageUrl: string,
  options?: { timeout?: number }
): Promise<DepthEstimationResult>

=== 实现逻辑 ===

1. 调用 runPrediction（来自 /src/lib/api/replicate.ts），模型使用：
   - 首选："apple/depth-pro"（如Replicate上不可用则改用备选）
   - 备选1："adirik/depth-anything-v2-large"
   - 备选2："prs-eth/marigold-lcm"
   - 在代码中定义常量 DEPTH_MODELS 数组，按优先级排列
   
2. input参数：
   { image: imageUrl }
   
3. 拿到output后（通常是图片URL或base64）：
   - 如果是URL：直接用fetch下载为Buffer
   - 如果是base64：decode为Buffer
   
4. 上传到R2：
   - key: `depth-maps/${schemeId}/${Date.now()}.png`
   - 使用 uploadToR2（来自 /src/lib/api/r2.ts）
   
5. 返回 DepthEstimationResult

=== 错误处理 ===

- Replicate超时（默认90s）：抛出明确错误 "深度估计超时"
- 模型不可用：自动fallback到下一个模型
- 输出格式异常：记录错误并抛出

=== 导出 ===

export { estimateDepth, DEPTH_MODELS }
export type { DepthEstimationResult }

注意：不创建API route，这是一个纯服务端模块，被后续的generation API调用。
使用 "server-only" import guard。
```

**验收标准：**
- [ ] estimateDepth 函数可调用并返回深度图R2 URL
- [ ] 支持模型fallback机制
- [ ] 处理耗时正确记录
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-1: depth estimation module with DepthPro via Replicate`

---

## Task 3.2 — FLUX渲染模块（Prompt Builder + ControlNet Depth）

**用深度图作为空间约束，用风格prompt作为审美约束，生成效果图。**

**交给 Codex 的 prompt：**

```
创建两个文件：

=== Part A: Prompt Builder ===

创建 /src/lib/generation/promptBuilder.ts

根据scheme数据构建FLUX渲染prompt。

export interface PromptContext {
  roomType: string;            // living_room / bedroom / dining_room
  style: string;               // midcentury / cream_french / wabi_sabi / song / dopamine
  furniture: Array<{
    name: string;
    category: string;
    widthMm: number;
    depthMm: number;
  }>;
  roomWidthMm: number;
  roomDepthMm: number | null;
  aestheticKeywords?: string[];  // 用户选的审美关键词
}

export function buildFluxPrompt(context: PromptContext): string

实现逻辑：
1. 从 /src/lib/constants.ts 的 FLUX_PROMPTS 获取风格基础prompt
2. 在基础prompt后追加家具描述：
   - 按 primary → secondary → accessory 顺序
   - 每件家具用自然语言描述："{name}, {widthMm/1000}m wide"
   - 最多描述6件核心家具（太多会稀释prompt效果）
3. 追加空间描述："room approximately {width}m × {depth}m"
4. 追加固定后缀：
   "interior photography, eye-level perspective, natural daylight from windows, 
    8K resolution, photorealistic, architectural digest quality, 
    no text, no watermark, no people"
5. 如果有aestheticKeywords，追加到prompt中
6. 返回完整prompt字符串

export function buildNegativePrompt(): string
返回固定负面prompt：
"distorted proportions, unrealistic scale, cartoon, anime, sketch, 
 blurry, low quality, text, watermark, signature, people, 
 oversaturated colors, floating furniture, impossible geometry"

=== Part B: FLUX Renderer ===

创建 /src/lib/generation/fluxRenderer.ts

export interface FluxRenderResult {
  imageUrl: string;            // 渲染图R2 URL
  prompt: string;              // 使用的完整prompt
  model: string;               // FLUX模型标识
  seed: number;                // 用于复现的seed
  processingTimeMs: number;
}

export interface FluxRenderOptions {
  depthImageUrl: string;       // 深度图URL（来自Task 3.1）
  prompt: string;              // 来自buildFluxPrompt
  negativePrompt?: string;
  width?: number;              // 默认1024
  height?: number;             // 默认768
  seed?: number;               // 不传则随机
  guidanceScale?: number;      // 默认7.5
  controlnetConditioningScale?: number; // 深度控制强度，默认0.6
  numInferenceSteps?: number;  // 默认30
  timeout?: number;
}

export async function renderWithFlux(
  schemeId: string,
  options: FluxRenderOptions
): Promise<FluxRenderResult>

实现逻辑：
1. 生成随机seed（如未提供）：Math.floor(Math.random() * 2147483647)
2. 调用 runPrediction，模型优先级：
   - 首选："black-forest-labs/flux-depth-pro"
   - 备选1："black-forest-labs/flux-1.1-pro"（不带depth控制，降级）
   - 备选2："black-forest-labs/flux-schnell"（最快但质量低）
   
3. input参数（以flux-depth-pro为例）：
   {
     control_image: options.depthImageUrl,
     prompt: options.prompt,
     negative_prompt: options.negativePrompt ?? buildNegativePrompt(),
     width: options.width ?? 1024,
     height: options.height ?? 768,
     seed: seed,
     guidance_scale: options.guidanceScale ?? 7.5,
     controlnet_conditioning_scale: options.controlnetConditioningScale ?? 0.6,
     num_inference_steps: options.numInferenceSteps ?? 30,
     output_format: "png"
   }
   注意：Replicate模型的实际参数名可能不同，需要根据模型文档调整。
   如果首选模型参数不匹配，代码中预留参数映射逻辑。

4. 拿到output（图片URL）→ fetch下载为Buffer → 上传R2
   key: `effect-images/${schemeId}/${Date.now()}_v1.png`

5. 返回 FluxRenderResult

错误处理：
- 模型不可用时自动fallback
- NSFW过滤器触发时重新生成（换seed）
- 超时默认120s（FLUX Pro较慢）

两个文件都使用 "server-only" import guard。
```

**验收标准：**
- [ ] buildFluxPrompt 正确拼接5种风格的prompt
- [ ] renderWithFlux 调用Replicate并返回R2 URL
- [ ] 模型fallback机制工作
- [ ] seed可复现
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-2: FLUX rendering module with prompt builder and depth control`

---

## Task 3.3 — 热点标注模块（Claude Vision）

**分析渲染后的效果图，标注每件家具的位置坐标，用于前端可点击热点。**

**交给 Codex 的 prompt：**

```
创建 /src/lib/generation/hotspotDetector.ts。

=== 功能 ===

给Claude Vision一张效果图+家具清单，让它标注每件家具在图中的位置。

=== 接口 ===

export interface DetectedHotspot {
  productId: string;
  label: string;
  x: number;      // 0-1，相对图片宽度
  y: number;      // 0-1，相对图片高度
  width: number;   // 0-1
  height: number;  // 0-1
  confidence: number; // 0-1
}

export interface HotspotDetectionResult {
  hotspots: DetectedHotspot[];
  processingTimeMs: number;
}

export async function detectHotspots(
  imageUrl: string,
  furniture: Array<{
    id: string;
    name: string;
    category: string;
  }>
): Promise<HotspotDetectionResult>

=== 实现逻辑 ===

1. 构建system prompt：
   "你是一个家具位置标注专家。给你一张室内效果图和一个家具清单，
    你需要标注每件家具在图中的位置。
    输出JSON数组，每个元素包含：
    - id: 家具ID（从输入清单中匹配）
    - label: 家具名称
    - x, y: 家具中心点的相对坐标（0-1，左上角为原点）
    - width, height: 家具占图的相对宽高（0-1）
    - confidence: 你对这个标注的置信度（0-1）
    
    只输出JSON，不要其他文字。如果某件家具在图中找不到，不要包含它。"

2. 构建user prompt：
   "请标注以下家具在图中的位置：\n" +
   furniture.map(f => `- ${f.id}: ${f.name} (${f.category})`).join("\n")

3. 调用 analyzeImage（来自 /src/lib/api/claude.ts）

4. 解析返回的JSON：
   - 尝试 JSON.parse
   - 如果返回包含```json```代码块，先提取代码块内容
   - 验证每个hotspot的坐标在0-1范围内
   - 过滤confidence < 0.3的结果

5. 返回 HotspotDetectionResult

=== 错误处理 ===

- JSON解析失败：返回空hotspots数组（不阻塞流程）
- Claude超时：返回空hotspots数组
- 坐标越界：clamp到0-1范围

使用 "server-only" import guard。
```

**验收标准：**
- [ ] detectHotspots 正确调用Claude Vision
- [ ] JSON解析健壮（处理代码块、格式异常）
- [ ] 错误不阻塞主流程
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-3: hotspot detection module via Claude Vision`

---

## Task 3.4 — 效果图生成 API（完整异步管线编排）

**这是Phase 3的核心。编排深度估计→FLUX渲染→热点标注的完整流程。**

**交给 Codex 的 prompt：**

```
创建两个API路由：

=== Part A: POST /api/generate/effect-image ===

创建 /src/app/api/generate/effect-image/route.ts

请求体：{ scheme_id: string }

流程：
1. 读取scheme + room_analysis（获取photo_url）+ scheme_products + products
2. 在 effect_images 表创建记录：
   {
     scheme_id,
     image_url: '',
     generation_status: 'pending',
     generation_params: { started_at: Date.now() },
     version: (当前最大version + 1)
   }
3. 返回 { success: true, effectImageId: record.id }（立即返回，不等待生成完成）
4. 用 waitUntil 或 after（Next.js after API）在后台执行管线：

   async function runPipeline(effectImageId, schemeId, photoUrl, scheme, products) {
     try {
       // Step 1: 深度估计
       更新 generation_status = 'depth'
       const depth = await estimateDepth(photoUrl);
       
       // Step 2: 构建prompt
       const promptContext = {
         roomType: scheme.room_type,
         style: scheme.style ?? 'dopamine',
         furniture: products.map(p => ({
           name: p.name, category: p.category,
           widthMm: p.width_mm, depthMm: p.depth_mm
         })),
         roomWidthMm: room_analysis.constraints_json.sofa_wall_width_mm,
         roomDepthMm: room_analysis.constraints_json.room_depth_mm,
       };
       const prompt = buildFluxPrompt(promptContext);
       
       // Step 3: FLUX渲染
       更新 generation_status = 'flux'
       const render = await renderWithFlux(schemeId, {
         depthImageUrl: depth.depthImageUrl,
         prompt,
         width: 1024,
         height: 768,
       });
       
       // Step 4: 热点标注
       更新 generation_status = 'hotspot'
       const hotspots = await detectHotspots(render.imageUrl, 
         products.map(p => ({ id: p.id, name: p.name, category: p.category }))
       );
       
       // Step 5: 完成
       更新 effect_images 记录：
         image_url = render.imageUrl,
         hotspot_map = hotspots.hotspots,
         generation_status = 'done',
         generation_params = {
           prompt: render.prompt,
           seed: render.seed,
           model: render.model,
           depth_model: depth.model,
           depth_time_ms: depth.processingTimeMs,
           render_time_ms: render.processingTimeMs,
           hotspot_time_ms: hotspots.processingTimeMs,
           total_time_ms: Date.now() - startTime,
         }
         
     } catch (error) {
       更新 effect_images 记录：
         generation_status = 'failed',
         error_message = error.message
     }
   }

关于后台执行：
- Next.js 15+ 使用 import { after } from 'next/server'; after(() => runPipeline(...))
- 如果after不可用，使用 waitUntil 或简单的 void runPipeline(...)（不await）
- 关键：API必须立即返回，不能等管线完成

Supabase操作使用服务端client（import { createClient } from '@supabase/supabase-js'，
用SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，不走RLS）。

=== Part B: GET /api/generate/status ===

创建 /src/app/api/generate/status/route.ts

query参数：scheme_id

流程：
1. 从 effect_images 表查询该scheme最新版本的记录
2. 返回：
   {
     status: record.generation_status,  // pending/depth/flux/hotspot/done/failed
     imageUrl: record.image_url || null,
     errorMessage: record.error_message || null,
     version: record.version,
     params: record.generation_params
   }
```

**验收标准：**
- [ ] POST /api/generate/effect-image 立即返回，后台执行管线
- [ ] GET /api/generate/status 正确返回当前状态
- [ ] effect_images 表记录完整的生成参数
- [ ] 失败时记录error_message
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-4: effect image generation API with async pipeline orchestration`

---

## Task 3.5 — Loading页 + 结果页集成效果图

**Loading页增加渲染阶段，结果页展示效果图+可点击热点。**

**交给 Codex 的 prompt：**

```
修改两个页面：

=== Part A: 修改 /generate/loading/page.tsx ===

在现有的 analyzing → recommending → finalizing 流程后，增加效果图生成阶段。

新的PipelineStage增加：
- "rendering_depth": "正在分析空间深度..."  (30-40%)
- "rendering_flux": "正在生成风格效果图..."  (40-75%)
- "rendering_hotspot": "正在标注家具位置..." (75-90%)

修改 runPipeline：
1. 原有流程不变：analyze → recommend
2. 在recommend完成后，调用 POST /api/generate/effect-image
3. 开始轮询 GET /api/generate/status?scheme_id=xxx（每2秒）
4. 根据返回的status更新stage：
   - "pending" → rendering_depth
   - "depth" → rendering_depth
   - "flux" → rendering_flux
   - "hotspot" → rendering_hotspot
   - "done" → 跳转结果页
   - "failed" → 显示错误+允许重试
5. 轮询最多120秒，超时后显示：
   "效果图生成时间较长，你可以先查看布局图方案"
   + "查看布局方案"按钮（跳转结果页，没有效果图也能看布局图+推荐清单）

=== Part B: 修改结果页 ===

修改 /src/components/result/ResultDashboardClient.tsx 和 /src/app/result/[schemeId]/page.tsx。

在结果页顶部（校验报告之上）增加效果图区域：

1. 结果页server component中，额外查询 effect_images 表最新记录
2. 传给 ResultDashboardClient 新的prop：
   effectImage?: {
     imageUrl: string;
     hotspots: Array<{ productId: string; label: string; x: number; y: number; width: number; height: number }>;
     status: string;
   }

3. 效果图展示区域：
   - 如果有effectImage且status=done：
     全宽图片，叠加可点击热点圆点（根据hotspot坐标定位）
     点击热点 → 高亮下方推荐清单中对应的商品卡片（scrollIntoView）
     图片右上角显示"AI生成效果图"标签
   - 如果status=pending/depth/flux/hotspot：
     显示骨架屏+进度提示"效果图生成中..."
   - 如果status=failed或无记录：
     显示占位区域"效果图生成失败"+"重新生成"按钮
     "重新生成"调用 POST /api/generate/effect-image 并开始轮询
   - 效果图下方保留原有的布局图和校验报告（不变）

4. 热点圆点样式：
   - 绝对定位在图片上
   - 40px圆点，白色半透明背景+品牌色边框
   - hover时显示tooltip（家具名称）
   - 移动端48px
   - 点击时圆点pulse动画

5. 页面布局调整为：
   效果图（全宽，如有）
   ↓
   校验报告摘要
   ↓
   2.5D布局图
   ↓
   推荐商品清单

样式使用Tailwind，和现有品牌色一致（#8B5A37, #F5F0E9等）。
```

**验收标准：**
- [ ] Loading页展示渲染进度（depth/flux/hotspot三阶段）
- [ ] 结果页顶部展示效果图
- [ ] 热点圆点可点击且正确定位
- [ ] 无效果图时降级展示布局图
- [ ] 超时处理优雅
- [ ] 移动端适配
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-5: integrate effect image into loading and result pages`

---

## Task 3.6 — 管线可靠性 + 收尾

**增加重试、降级、参数调优，确保管线在真实环境下稳定运行。**

**交给 Codex 的 prompt：**

```
Phase 3 收尾任务，包含多个小改动：

=== Part A: Replicate调用增加重试 ===

修改 /src/lib/api/replicate.ts：
- 新增 runPredictionWithRetry(model, input, { timeout, maxRetries, retryDelayMs })
- 默认 maxRetries=2, retryDelayMs=3000
- 只在网络错误或超时时重试，模型返回failed不重试
- 导出 runPredictionWithRetry

修改 depthEstimator.ts 和 fluxRenderer.ts，将 runPrediction 替换为 runPredictionWithRetry。

=== Part B: 效果图版本管理 ===

修改 /src/app/result/[schemeId]/page.tsx：
- 如果effect_images有多个版本（version > 1），显示版本切换器
- 简单的"上一版 / 下一版"按钮
- 显示当前版本号 "效果图 v{version}"

=== Part C: 重新生成按钮 ===

在结果页效果图区域右上角增加"重新生成"按钮：
- 点击后调用 POST /api/generate/effect-image
- 显示loading状态
- 生成完成后刷新页面

=== Part D: 环境变量检查 ===

创建 /src/lib/generation/envCheck.ts：
- export function checkGenerationEnv(): { ready: boolean; missing: string[] }
- 检查：REPLICATE_API_TOKEN, ANTHROPIC_API_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME
- 在 /api/generate/effect-image 的开头调用，缺少环境变量时返回明确错误而非500

=== Part E: 数据库迁移说明 ===

在 docs/ 下创建 PHASE_3_MIGRATION.md：
- 说明 effect_images 表需要哪些字段
- 提供 ALTER TABLE SQL（如果现有表缺少 generation_status, error_message 字段）
- 说明 R2 bucket 的 CORS 配置要求
```

**验收标准：**
- [ ] Replicate调用有重试机制
- [ ] 效果图支持版本切换
- [ ] "重新生成"按钮可用
- [ ] 环境变量缺失时报错清晰
- [ ] 迁移文档完整
- [ ] npm run lint && npm run build 通过

**Commit**: `phase-3/task-6: pipeline reliability, retry logic, and migration docs`

---

## Phase 3 完成检查清单

```bash
npm run lint    # 0 errors
npm run build   # 成功
npm run test    # 校验测试仍通过
```

手动验收（需要Replicate API Token + R2配置）：
1. /create → 上传真实客厅照片 → 提交
2. Loading页显示：分析空间 → 匹配家具 → 分析深度 → 生成效果图 → 标注热点
3. 进入结果页：顶部显示AI效果图
4. 效果图上有可点击的热点圆点
5. 点击热点 → 下方推荐清单对应商品高亮
6. 点击"重新生成" → 新版本生成 → 版本切换可用
7. 布局图和校验报告仍然正常显示

**无Replicate Token时的降级验证：**
1. 提交后Loading页到rendering_depth阶段显示错误
2. 结果页显示"效果图生成失败" + "重新生成"按钮
3. 布局图+校验报告+推荐清单仍然正常（核心功能不受影响）

---

## 给 Codex 的执行指令

```
docs/PHASE_3_TASKS.md 已准备好（项目根目录下 PHASE_3_TASKS.md）。
请先将它移动到 docs/ 目录：mv PHASE_3_TASKS.md docs/

然后按顺序执行 Task 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6。

每个Task完成后 npm run lint && npm run build 通过再进入下一个。
每个Task单独commit，commit message按文档中指定的格式。
全部完成后 git push origin main。

注意：
- 深度估计和FLUX渲染都通过Replicate API调用，复用 /src/lib/api/replicate.ts
- R2上传复用 /src/lib/api/r2.ts
- Claude Vision调用复用 /src/lib/api/claude.ts
- 效果图状态存储在Supabase的 effect_images 表
- 后台管线执行用Next.js的after()或不await的async函数
- Replicate模型的实际参数名需要查看模型文档，代码中做好参数映射

始终使用中文回复。
```
