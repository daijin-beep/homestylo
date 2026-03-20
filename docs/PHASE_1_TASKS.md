# Phase 1 Task Cards — 空间+审美一体化输入

> **核心理念：一个页面收集所有信息，直接生成效果图。不强制走流程，不打断用户。**
>
> 页面布局：左侧上传照片+空间设置，右侧审美偏好选项（移动端上下排列）
> 审美偏好中只有"风格"建议选择，其余全部选填。
> 分析结果不返回给用户看，带着结果直接生成。
>
> **执行顺序：Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5**
> 始终使用中文回复。

---

## Task 1.1 — 首页入口改造

**交给 Codex 的 prompt：**

```
改造首页 /src/app/page.tsx。

页面结构简洁有力，只做一件事：让用户点击进入核心功能页。

1. Hero 区域（居中）：
   - 大标题："买大件前，先放进你家看看"
   - 副标题："上传房间照片，选择你喜欢的风格，AI 30秒生成搭配效果图"
   - 主 CTA 按钮："开始设计我的房间" → /create
   - 按钮下方小字："免费体验一次，无需注册"

2. Before / After 展示区：
   - 并排两张图（移动端上下）
   - 左：一张普通客厅实拍照（用 placeholder 图 /images/before.jpg）
   - 右：同空间的AI效果图（用 placeholder 图 /images/after.jpg）
   - 标题："你的房间，也可以变成这样"

3. 三步简要说明（横向，移动端竖向）：
   - 📷 "上传房间照片"
   - 🎨 "选择你的风格偏好"
   - ✨ "30秒生成效果图"

4. 底部重复 CTA："免费开始" → /create

UI规范：
- 背景色 #F5F0E9
- 大标题 36px（移动端 28px），Noto Serif SC，字重 800
- CTA 按钮：#8B5A37 背景，白色文字，圆角 12px，高度 52px，min-width 240px
- 移动端优先
- 不需要登录

技术要求：
- Server Component
- 在 middleware.ts 中将 / 和 /create 加入公开路由
- placeholder 图片放在 /public/images/ 目录下（先创建空的 placeholder 文件或用纯色块代替）
```

**Commit**: `phase-1/task-1: landing page with create entry`

---

## Task 1.2 — 核心创建页 `/create`（空间+审美一体化）

**这是整个产品最重要的页面。**

**交给 Codex 的 prompt：**

```
创建核心页面 /src/app/create/page.tsx。

这是HomeStylo的核心交互页面。一个页面收集所有输入信息，用户填完后一键生成效果图。
布局：桌面端左右两栏（左60%右40%），移动端上下排列。

=== 左侧：空间输入区 ===

Section 1 — 房间照片上传（必填）：
- 大面积虚线框 drop zone，用 react-dropzone
- 中间相机图标 + "上传你的房间照片"
- 接受 jpg/png/heic，最大 10MB
- 上传后显示图片预览，右上角有"重新选择"按钮
- 移动端高度至少 200px

Section 2 — 户型图上传（选填）：
- 较小的 drop zone："上传户型图（选填，提升精度）"
- 上传后显示预览

Section 3 — 房间类型（必填）：
- 三个可选卡片横排：客厅 / 卧室 / 餐厅
- 图标 + 文字，选中态有品牌色边框
- 默认不选中，必须选一个

Section 4 — 精度模式：
- 两个 Tab 切换：
  - "简易模式"（默认选中）— 不需要输入尺寸，AI自动估算
  - "高精度模式" — 需要手动输入尺寸
- 简易模式下：
  - 显示提示文字："AI将根据照片自动估算空间尺寸"
  - 无额外输入
- 高精度模式下：
  - 显示尺寸输入区域：
    - "沙发墙净宽" — 数字输入框，单位mm，placeholder "例如：3600"
    - "房间进深" — 数字输入框，单位mm，placeholder "例如：4500"（选填）
    - "层高" — 数字输入框，单位mm，placeholder "例如：2800"（选填）
  - 提示文字："精确尺寸可以让效果图更准确，避免家具过大或过小"
- 注意：如果用户上传了户型图，后续API分析时如果识别到了尺寸，会自动切换到高精度模式并填充数据（这个逻辑在Task 1.4中处理，这里只做UI）

=== 右侧：审美偏好区 ===

Section A — 风格偏好（建议选择，非强制）：
- 5个风格选项，用卡片展示（2列网格）：
  - 中古风 — 色块 #8B5A37 + 标签
  - 多巴胺 — 色块 #E84393 + 标签
  - 奶油法式 — 色块 #FFEAA7 + 标签
  - 宋式美学 — 色块 #636E72 + 标签
  - 侘寂 — 色块 #B2BEC3 + 标签
- 可以不选（默认AI自动判断）或选一个
- 选中态：边框高亮 + 色块放大

Section B — 情绪版/灵感图（选填）：
- 标题："选择你喜欢的感觉"
- 展示6-8张预设的情绪版图片（不同风格的家居场景组图）
- 2列网格，每张约 160x100px
- 可多选（最多选3张）
- 选中态：边框高亮 + 半透明遮罩 + 对勾
- 图片用 placeholder（/images/moodboard/mood_1.webp 到 mood_8.webp）

Section C — 颜色偏好（选填）：
- 标题："你偏好的色调"
- 一行8个色块圆形按钮：
  - 暖白 #FFF8F0
  - 米棕 #C8956C
  - 焦糖 #8B5A37
  - 橄榄绿 #6B8E6B
  - 深蓝 #2B3A4A
  - 灰粉 #D4A5A5
  - 明黄 #FDCB6E
  - 酒红 #C0392B
- 可多选（最多选3个）
- 选中态：外圈加粗边框 + 放大

Section D — 参考案例上传（选填）：
- 标题："上传你喜欢的参考图"
- 小型 drop zone，可上传1-3张参考图片
- 上传后缩略图预览，可删除
- 提示文字："小红书看到的喜欢的案例？传上来让AI参考"

=== 底部 ===

固定底部栏（移动端 sticky bottom）：
- 左侧显示已填写状态：
  - ✅ 照片已上传 / ⬜ 未上传照片
  - ✅ 已选风格 / ⬜ AI自动匹配（如果没选风格）
- 右侧 CTA 按钮："生成效果图"
  - disabled 条件：照片未上传 OR 房间类型未选
  - 点击后的逻辑在 Task 1.4 中实现，这里先跳转到一个 loading 页 /generate/loading

=== 数据存储 ===

所有选择状态用一个 useState 管理，结构如下：
interface CreatePageState {
  // 空间
  roomPhoto: File | null;
  roomPhotoPreview: string | null;
  floorPlanPhoto: File | null;
  floorPlanPreview: string | null;
  roomType: 'living_room' | 'bedroom' | 'dining_room' | null;
  precisionMode: 'simple' | 'precision';
  dimensions: {
    sofaWallWidth: number | null;  // mm
    roomDepth: number | null;      // mm
    ceilingHeight: number | null;  // mm
  };
  // 审美
  selectedStyle: string | null;  // 'midcentury' | 'dopamine' | ... | null
  selectedMoodboards: string[];  // mood_1, mood_2, ... 最多3个
  selectedColors: string[];      // hex值数组，最多3个
  referencePhotos: File[];       // 最多3张
  referencePhotoPreviews: string[];
}

UI规范：
- 左侧白色卡片背景，右侧 #F5F0E9 浅背景，区分两个区域
- 所有 Section 标题用 16px 加粗，下方 4px 的品牌色下划线装饰
- 卡片选中动画用 framer-motion: scale(1.03) + shadow
- 所有输入区域之间 gap-6
- 色块圆形按钮直径 40px（移动端 36px）
- 移动端：左右栏变为上下排列，空间输入在上，审美偏好在下

技术要求：
- 'use client' 组件
- 不需要登录即可使用此页面（在 middleware.ts 加入公开路由）
- 文件预览用 URL.createObjectURL
- 组件拆分建议：
  - components/create/PhotoUploadSection.tsx
  - components/create/RoomTypeSelector.tsx
  - components/create/PrecisionModeToggle.tsx
  - components/create/StyleSelector.tsx
  - components/create/MoodboardSelector.tsx
  - components/create/ColorPicker.tsx
  - components/create/ReferenceUpload.tsx
  - components/create/BottomBar.tsx
- 每个子组件通过 props 接收状态和 onChange 回调
```

**验收标准：**
- [ ] 页面完整渲染左右两栏（桌面端）/ 上下排列（移动端）
- [ ] 照片上传和预览正常
- [ ] 房间类型三选一正常
- [ ] 精度模式切换正常，高精度模式显示尺寸输入
- [ ] 风格选择可选可不选
- [ ] 情绪版多选（最多3）正常
- [ ] 颜色多选（最多3）正常
- [ ] 参考图上传和预览正常
- [ ] 底部栏状态指示正确
- [ ] CTA按钮disable/enable逻辑正确
- [ ] 移动端体验流畅
- [ ] npm run build 通过

**Commit**: `phase-1/task-2: core create page with space and aesthetic inputs`

---

## Task 1.3 — 生成等待页 `/generate/loading`

**交给 Codex 的 prompt：**

```
创建生成等待页 /src/app/generate/loading/page.tsx。

这是用户点击"生成效果图"后看到的等待页面。Phase 1 中只做UI骨架，实际生成逻辑在 Phase 2 实现。

页面内容：
1. 全屏居中布局，品牌背景色
2. 中间：
   - 一个优雅的加载动画（可以是圆形进度环，或品牌色脉冲动画）
   - 用 framer-motion 做动画
3. 加载文案轮播（每3秒切换，淡入淡出）：
   - "AI正在理解你的空间..."
   - "分析墙面和光线..."
   - "匹配你的风格偏好..."
   - "挑选最适合的家具..."
   - "生成搭配效果图..."
   - "即将完成..."
4. 底部小字："通常需要30-45秒"
5. 进度条（假进度）：
   - 0-30%：前5秒快速填充（空间分析）
   - 30-70%：中间20秒缓慢填充（效果图生成）
   - 70-90%：后10秒填充（细节优化）
   - 90-100%：最后5秒（完成）
   - Phase 1 中进度到100%后显示"效果图生成功能即将上线，敬请期待"+ 返回首页按钮
   - Phase 2 中会替换为真实的生成进度

UI规范：
- 背景色 #F5F0E9
- 文案 20px，品牌前景色
- 进度条：品牌主色 #8B5A37，高度 4px，圆角
- 整体氛围要沉稳有质感，不要花哨

技术要求：
- 'use client'
- framer-motion 动画
- 使用 useEffect + setInterval 控制文案切换和假进度
- 不需要登录
```

**验收标准：**
- [ ] 加载动画流畅
- [ ] 文案每3秒轮播
- [ ] 假进度条按节奏推进
- [ ] 进度100%后显示占位提示

**Commit**: `phase-1/task-3: generation loading page with animated progress`

---

## Task 1.4 — 创建页提交逻辑 + 空间分析API

**交给 Codex 的 prompt：**

```
为 /create 页面的"生成效果图"按钮添加完整的提交逻辑，并创建空间分析API。

=== Part A: 提交逻辑（修改 create/page.tsx 的 BottomBar 组件）===

用户点击"生成效果图"后的完整流程：
1. 按钮变为 loading 状态，显示"正在上传..."
2. 如果用户未登录：
   - 将当前页面所有状态序列化存入 sessionStorage key 'homestylo_create_state'
   - 跳转 /login?redirect=/create（登录后回来恢复状态）
3. 如果已登录，执行上传：
   a. 上传实拍照到 Supabase Storage 'room-photos' bucket，路径 {user_id}/{timestamp}.jpg
   b. 如有户型图，上传到同bucket
   c. 如有参考图，逐张上传到 'room-photos' bucket 下 {user_id}/references/ 目录
   d. 创建 schemes 表记录：
      - room_type: 用户选择
      - style: 用户选择的风格（可能为null）
      - user_id: 当前用户
      - status: 'analyzing'
   e. 创建 room_analysis 表记录：
      - scheme_id
      - photo_url: 实拍照URL
      - floor_plan_url: 户型图URL（可能为null）
   f. 将审美偏好数据存入 scheme 的一个新字段或单独存储：
      - 在 schemes 表中我们没有审美偏好字段，所以用 localStorage 临时存储：
      - key: 'homestylo_aesthetic_{scheme_id}'
      - value: JSON { style, moodboards, colors, referencePhotoUrls }
   g. 更新 schemeStore
   h. 调用空间分析API：POST /api/room/analyze { scheme_id }
   i. 不等分析完成，直接跳转到 /generate/loading?scheme_id={id}
4. 如果上传失败，toast 提示错误

=== Part B: /create 页面恢复状态 ===

页面加载时检查 sessionStorage 'homestylo_create_state'：
- 如果存在，恢复所有状态（照片需要重新上传，但文本选项可以恢复）
- 恢复后清除 sessionStorage

=== Part C: 空间分析 API（/src/app/api/room/analyze/route.ts）===

POST 请求，body: { scheme_id: string }

流程：
1. Supabase service role client 获取 room_analysis 记录
2. 获取照片 signed URL
3. 调用 Claude Vision API 分析实拍照：

system prompt:
"""
你是一个专业的室内空间分析师。分析这张室内照片，输出JSON格式的空间结构数据。

要求：
1. 识别每面可见墙面的类型：solid_wall / window / door / opening
2. 估算每面墙宽度（毫米）
3. 判断拍摄方向
4. 给出置信度(0-1)

严格输出JSON：
{
  "walls": [
    {"id": "wall_1", "type": "solid_wall", "estimated_width_mm": 3600, "label": "沙发背景墙"}
  ],
  "shooting_direction": "从入户方向朝客厅拍摄",
  "confidence": 0.75
}
"""

4. 如有户型图，第二次调用提取尺寸：

system prompt:
"""
你是户型图解读专家。提取标注的尺寸数据。
输出JSON：
{
  "rooms": [{"name": "客厅", "width_mm": 6000, "depth_mm": 4500}],
  "total_area_sqm": 120
}
"""

5. 如果户型图成功识别到了尺寸：
   - 将尺寸合并到 structure_json 中
   - 自动填充 constraints_json 的精确数值
   - 返回 precision_mode: 'precision'

6. 如果没有户型图或未识别到尺寸：
   - 用照片估算值
   - 返回 precision_mode: 'simple'

7. 如果用户在 /create 页面已手动输入了尺寸（高精度模式）：
   - 检查 room_analysis 是否已有 constraints_json（由前端在创建时写入）
   - 如果有，用用户输入的值覆盖AI估算值

8. 生成 constraints_json：
   {
     sofa_wall_width_mm: 最大实墙宽度,
     tv_wall_width_mm: 对面墙宽度,
     room_depth_mm: 户型图值或null,
     max_sofa_width_mm: sofa_wall_width_mm * 0.75,
     max_tv_cabinet_width_mm: tv_wall_width_mm * 0.75
   }

9. 保存到 room_analysis 表，更新 user_confirmed = true（简易模式自动确认）
10. 返回 { success: true, structure, constraints, precision_mode }

错误处理：try-catch，30秒超时，友好错误信息
```

**验收标准：**
- [ ] 点击"生成效果图"后上传流程正常
- [ ] 未登录时正确跳转登录页并回来恢复状态
- [ ] schemes 和 room_analysis 记录正确创建
- [ ] 空间分析API正确调用 Claude Vision 并返回结构化数据
- [ ] 户型图尺寸识别后自动标记为精度模式
- [ ] 跳转到 /generate/loading 页面

**Commit**: `phase-1/task-4: create page submit logic and space analysis API`

---

## Task 1.5 — 数据库补充 + 全局导航

**交给 Codex 的 prompt：**

```
两件收尾工作：

=== Part A: schemes 表补充字段 ===

在 Supabase SQL Editor 中执行（或创建迁移文件 supabase/migrations/001_add_aesthetic_fields.sql）：

ALTER TABLE public.schemes 
ADD COLUMN IF NOT EXISTS aesthetic_preferences JSONB DEFAULT '{}';

-- aesthetic_preferences 存储结构：
-- {
--   "style": "midcentury" | null,
--   "moodboards": ["mood_1", "mood_3"],
--   "colors": ["#8B5A37", "#6B8E6B"],
--   "reference_photo_urls": ["https://..."]
-- }

同时修改 /create 页面的提交逻辑：
- 将审美偏好存入 schemes.aesthetic_preferences 字段而非 localStorage
- 删除之前用 localStorage 存审美偏好的代码

更新 /src/lib/types/index.ts 的 Scheme interface：
- 添加 aesthetic_preferences 字段：
  aesthetic_preferences: {
    style: string | null;
    moodboards: string[];
    colors: string[];
    reference_photo_urls: string[];
  } | null;

=== Part B: 全局顶部导航 ===

创建 /src/components/Navbar.tsx：
1. 左侧：HomeStylo 文字 logo，点击回首页
   - 字体 Noto Serif SC，字重 700，大小 20px，颜色 #8B5A37
2. 右侧：
   - "开始设计" 按钮 → /create（品牌主色小按钮）
   - 用户头像/登录入口
     - 未登录：显示"登录"文字链接 → /login
     - 已登录：显示用户手机号后4位的圆形头像，点击下拉菜单（我的方案/退出登录）
3. 导航栏高度 56px，白色背景，底部 1px #E5E5E5 边框
4. 移动端：logo + 右侧图标，不需要 hamburger（页面少）

在 /src/app/layout.tsx 中引入 Navbar，所有页面显示。
但在 /generate/loading 页面隐藏导航栏（生成等待页不需要导航干扰）。

技术要求：
- Navbar 是 'use client' 组件（需要读取auth状态）
- 用 supabase client 监听 auth 状态
- 下拉菜单用 shadcn 的 DropdownMenu 组件
```

**验收标准：**
- [ ] schemes 表新增 aesthetic_preferences 字段
- [ ] 审美偏好正确存入数据库而非 localStorage
- [ ] 导航栏在所有页面显示
- [ ] 登录/未登录状态正确切换
- [ ] 生成等待页不显示导航栏
- [ ] 类型定义已更新

**Commit**: `phase-1/task-5: aesthetic preferences db field and global navbar`

---

## Phase 1 完成检查清单

```bash
npm run lint          # 0 errors
npm run build         # 成功
```

手动验收流程：
1. 打开首页 → 看到"买大件前，先放进你家看看" → 点击"开始设计我的房间"
2. 进入 /create 页面 → 看到左右两栏布局
3. 左侧：上传一张客厅照片 → 选择"客厅" → 默认简易模式
4. 右侧：选一个风格 → 选1-2张情绪版 → 选1-2个颜色 → 可选上传参考图
5. 底部状态显示 ✅照片已上传 ✅已选风格
6. 点击"生成效果图" → 如未登录跳转登录
7. 登录后回到 /create，状态恢复
8. 再次点击"生成效果图" → 照片上传到Supabase → 记录创建 → 跳转生成等待页
9. 生成等待页显示动画和进度条 → 100%后显示占位提示

**这条完整链路跑通即为Phase 1通过。Phase 2接入真实的效果图生成管线。**

---

## 给 Codex 的执行顺序

1. **Task 1.1** → 首页（简单，快速完成）
2. **Task 1.2** → 核心创建页（最复杂，重点任务）
3. **Task 1.3** → 生成等待页（纯UI）
4. **Task 1.4** → 提交逻辑 + 空间分析API（连接前后端）
5. **Task 1.5** → 数据库补充 + 导航栏（收尾）

每个Task完成后 `npm run lint && npm run build` 通过再进入下一个。
