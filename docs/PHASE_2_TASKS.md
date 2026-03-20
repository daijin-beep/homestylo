# Phase 2 Task Cards — 尺寸校验引擎 + 2.5D 布局图

> **核心理念：准确比好看重要10倍。**
> 用户痛点不是"效果图不够美"，而是"尺寸比例不对，放不放得下我不知道"。
>
> Phase 2 目标：
> 1. 建立尺寸校验引擎 — 用户选的家具放不放得下，一算就知
> 2. 2.5D俯视布局图 — 按真实比例画出房间+家具，用户可拖拽调整
> 3. 效果图生成（初版）— 先做骨架，Phase 3 对接真实渲染
>
> **执行顺序：Task 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6**
> 始终使用中文回复。

---

## Task 2.1 — 尺寸校验引擎（纯计算，核心价值模块）

**这是HomeStylo区别于所有竞品的核心能力。纯数学计算，零AI依赖，100%准确。**

**交给 Codex 的 prompt：**

```
创建尺寸校验引擎 /src/lib/validation/dimensionValidator.ts。

这是一个纯函数模块，不依赖任何UI、API或数据库。输入房间尺寸和家具列表，输出校验结果和风险提示。

=== 输入类型 ===

interface RoomDimensions {
  sofaWallWidthMm: number;
  tvWallWidthMm: number;
  roomDepthMm: number | null;
  ceilingHeightMm: number | null;
}

interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  placement: 'sofa_wall' | 'tv_wall' | 'center' | 'corner' | 'dining_area';
}

=== 输出类型 ===

interface ValidationReport {
  overallStatus: 'pass' | 'warning' | 'block';
  items: ValidationItem[];
  layoutMetrics: LayoutMetrics;
  suggestions: string[];
}

interface ValidationItem {
  furnitureId: string;
  furnitureName: string;
  status: 'pass' | 'warning' | 'block';
  checks: Check[];
}

interface Check {
  rule: string;
  status: 'pass' | 'warning' | 'block';
  message: string;
  detail: string;
  actualValue: number;
  threshold: number;
}

interface LayoutMetrics {
  sofaWallOccupancy: number;
  tvWallOccupancy: number;
  sofaToTvDistance: number | null;
  passageWidth: number | null;
  sofaToCoffeeTableGap: number | null;
  coffeeTableToTvGap: number | null;
}

=== 校验规则（全部硬编码）===

规则1：沙发占墙宽比
- 沙发宽度 / 沙发墙净宽
- pass: ≤ 0.75
- warning: 0.75 - 0.85 → "沙发偏大，两侧空间较紧，建议预留至少300mm"
- block: > 0.85 → "沙发过大，无法合理摆放。建议换{推荐最大宽度}mm以内的款"

规则2：电视柜占墙宽比
- pass: ≤ 0.75, warning: 0.75-0.85, block: > 0.85

规则3：沙发到电视墙距离（需要roomDepthMm）
- roomDepthMm - 沙发深度 - 电视柜深度
- pass: ≥ 2500mm, warning: 2000-2500mm, block: < 2000mm

规则4：沙发到茶几间距
- (sofaToTvDistance - 茶几深度) / 2
- pass: 350-500mm, warning: 250-350mm, block: < 250mm

规则5：茶几占沙发比
- 茶几宽度 / 沙发宽度
- pass: 0.5-0.67, warning: < 0.4 或 > 0.75

规则6：通道宽度
- 房间宽度 - 沙发深度 - 餐桌宽度
- pass: ≥ 800mm, warning: 600-800mm, block: < 600mm

规则7：层高与家具高度
- 家具高度 / 层高
- pass: ≤ 0.65, warning: 0.65-0.75, block: > 0.75

规则8：地毯尺寸
- 地毯宽度 ≥ 沙发宽度 + 400mm

建议生成：如果沙发过大推荐最大宽度（墙宽×0.7），如果茶几比例不对推荐范围（沙发宽×0.5~0.67），层高充裕时给正面建议。

=== 导出 ===

export function validateLayout(room: RoomDimensions, furniture: FurnitureItem[]): ValidationReport
export function getMaxRecommendedSize(room: RoomDimensions, category: string): { maxWidthMm: number; maxDepthMm: number; reason: string }
export function calculateLayoutMetrics(room: RoomDimensions, furniture: FurnitureItem[]): LayoutMetrics

=== 单元测试 ===

创建 /src/lib/validation/__tests__/dimensionValidator.test.ts
使用 vitest。在 package.json 添加 "test" script。

测试用例：
1. 正常布局（3500mm墙，2400mm沙发）→ pass
2. 沙发过大（3500mm墙，3200mm沙发）→ block
3. 茶几比例不对（2400mm沙发，1800mm茶几）→ warning
4. 通道过窄 → block
5. 层高充裕 → pass + 正面建议
6. 无进深数据 → 距离规则返回null
```

**验收标准：**
- [ ] validateLayout 函数正确返回完整报告
- [ ] 8条规则全部实现
- [ ] 6个测试用例全部通过
- [ ] npm run test 通过

**Commit**: `phase-2/task-1: dimension validation engine with 8 rules and unit tests`

---

## Task 2.2 — 尺寸校验结果弹窗

**交给 Codex 的 prompt：**

```
创建校验结果弹窗 /src/components/create/ValidationResultDialog.tsx。
并修改 /create 页面的提交流程，在跳转前插入校验步骤。

=== 修改 handleSubmit 流程 ===

在上传完成、scheme创建后：
1. 如果高精度模式且有尺寸数据：调用 validateLayout()
   - 有 block：弹出校验弹窗，不跳转
   - 只有 warning 或 pass：弹出弹窗，用户确认后跳转
2. 简易模式或无尺寸：跳过校验直接跳转

=== ValidationResultDialog ===

使用 shadcn Dialog。Props:
{ open, report: ValidationReport, onConfirm, onCancel }

内容：
1. 标题：pass→绿色对勾"尺寸校验通过" / warning→黄色"有N项需注意" / block→红色"N件家具尺寸不合适"
2. 每个 ValidationItem 一行（家具名+状态图标），展开显示具体 Check
3. 布局指标：沙发占墙宽%（彩色进度条）、通道宽度mm、间距mm
4. suggestions 建议卡片
5. 底部：block时"返回修改"+"仍然继续"；无block时"确认并生成效果图"

状态色：pass=#22c55e warning=#eab308 block=#ef4444
Dialog最大宽度560px，移动端全屏。
```

**验收标准：**
- [ ] 高精度模式提交时弹出校验弹窗
- [ ] 三种状态正确展示
- [ ] block时阻止自动跳转
- [ ] 无尺寸数据时跳过校验

**Commit**: `phase-2/task-2: validation result dialog integrated with create page`

---

## Task 2.3 — 2.5D 俯视布局图组件

**交给 Codex 的 prompt：**

```
创建俯视布局图 /src/components/layout/FloorPlanView.tsx。

SVG组件，按真实mm比例绘制房间平面和家具色块，支持拖拽。

Props:
interface FloorPlanViewProps {
  room: { widthMm: number; depthMm: number; ceilingHeightMm?: number; walls: WallSegment[] };
  furniture: PlacedFurniture[];
  selectedFurnitureId: string | null;
  onFurnitureSelect: (id: string | null) => void;
  onFurnitureMove: (id: string, x: number, y: number) => void;
  readOnly?: boolean;
}

interface WallSegment { side: 'top'|'bottom'|'left'|'right'; startMm: number; endMm: number; type: 'wall'|'window'|'door'|'opening' }
interface PlacedFurniture { id: string; name: string; category: string; widthMm: number; depthMm: number; x: number; y: number; rotation: 0|90|180|270; color: string }

渲染逻辑：
1. 缩放：containerWidth / roomWidthMm = scale，所有mm×scale=px
2. 房间：矩形外框，墙面按type区分（wall粗线/window蓝虚线/door弧线/opening无线）
3. 尺寸标注：上方宽度、左侧进深
4. 家具：矩形色块（圆角4px），半透明填充，中间显示名称和尺寸
5. 选中态：品牌色边框+四角拖拽手柄
6. 拖拽：SVG mouse/touch事件，限制不超出房间，拖拽时显示到墙距离

颜色映射：sofa=#2B3A4A, coffee_table=#8B5A37, tv_cabinet=#6B8E6B, dining_table=#C8956C, rug=#DDD虚线框, floor_lamp=#FDCB6E小圆, bed=#9B59B6, side_table=#E67E22

不需要：3D视角、旋转UI、吸附对齐、碰撞检测（由validator处理）
```

**验收标准：**
- [ ] 房间按比例正确绘制
- [ ] 家具色块大小精确
- [ ] 拖拽交互正常
- [ ] 响应式

**Commit**: `phase-2/task-3: 2.5D floor plan view with draggable furniture`

---

## Task 2.4 — 家具输入面板

**交给 Codex 的 prompt：**

```
创建家具输入面板 /src/components/layout/FurniturePanel.tsx。

配合 FloorPlanView 使用，让用户添加/编辑/删除家具。

Props:
{ furniture: PlacedFurniture[]; selectedId: string|null; onAdd; onUpdate; onRemove; onSelect; roomDimensions: RoomDimensions }

功能：
1. 快速添加区：一行快捷按钮（沙发/茶几/电视柜/地毯/落地灯/餐桌/边几），点击弹出表单（名称/宽度mm/深度mm/高度mm），确认后添加到房间中心
2. 已添加列表：每行显示色块+名称+尺寸+删除，点击选中联动 FloorPlanView
3. 选中详情：位置坐标、到墙距离、相关校验结果
4. 底部："运行尺寸校验"按钮

面板宽度320px桌面端，移动端底部sheet。
```

**验收标准：**
- [ ] 添加/编辑/删除功能正常
- [ ] 列表与布局图联动
- [ ] 校验结果显示

**Commit**: `phase-2/task-4: furniture input panel with add/edit/remove`

---

## Task 2.5 — 布局规划页 `/layout-plan/[schemeId]`

**交给 Codex 的 prompt：**

```
创建布局规划页 /src/app/layout-plan/[schemeId]/page.tsx。

整合 FloorPlanView + FurniturePanel 的完整页面。

数据流：
1. 加载 scheme 和 room_analysis
2. 用 constraints_json 初始化 RoomDimensions
3. 页面顶部显示可编辑的房间尺寸
4. 左侧(60%) FloorPlanView，右侧(40%) FurniturePanel
5. 底部固定栏：保存布局 / 运行校验 / 生成效果图

修改 /create 提交流程：
- 原来跳转 /generate/loading
- 改为跳转 /layout-plan/{schemeId}

Middleware：将 /layout-plan 加入受保护路由。

移动端：上方布局图（全宽正方形），下方面板（可折叠sheet）。
```

**验收标准：**
- [ ] 从 /create 提交后跳转到此页
- [ ] 布局图按真实尺寸渲染
- [ ] 添加家具实时出现
- [ ] 拖拽位置更新
- [ ] 校验结果正确
- [ ] "生成效果图"跳转正常

**Commit**: `phase-2/task-5: layout planning page with floor plan and furniture panel`

---

## Task 2.6 — 效果图生成API骨架 + Loading页更新

**交给 Codex 的 prompt：**

```
Phase 2 不实现完整渲染管线，只做骨架。

=== Part A: POST /api/generate ===

创建 /src/app/api/generate/route.ts：
1. 接收 { scheme_id, layout: { room, furniture }, aesthetic }
2. 调用 validateLayout() 校验
3. 用 promptBuilder 生成 prompt
4. 保存 prompt 到 effect_images 表（generation_status='pending'）
5. 返回 { success, prompt, validation_report, status: 'pending' }

=== Part B: Prompt Builder ===

创建 /src/lib/generation/promptBuilder.ts：
export function buildGenerationPrompt(params): string
- 按 style 选择模板（参考 docs/DESIGN_SYSTEM.md）
- 注入房间尺寸、家具信息、颜色偏好
- 返回完整 prompt

=== Part C: GET /api/generate/status ===

创建 /src/app/api/generate/status/route.ts：
- query param: scheme_id
- 查询 effect_images 表最新记录的 generation_status
- 返回 { status, image_url (if done) }

=== Part D: 修改 /generate/loading 页面 ===

1. 从 URL 读取 scheme_id
2. 轮询 /api/generate/status（每3秒）
3. 状态映射：analyzing→0-30%, pending→30-50%, generating→50-90%, done→100%跳转结果页
4. Phase 2 到 pending 后显示："布局方案已保存。效果图渲染引擎升级中。"
   + "查看我的布局"按钮 → /layout-plan/{schemeId}
   + "返回首页"按钮
```

**验收标准：**
- [ ] POST /api/generate 接口可用
- [ ] prompt 正确生成并保存
- [ ] loading 页轮询状态
- [ ] Phase 3 可无缝对接

**Commit**: `phase-2/task-6: generation API skeleton and prompt builder`

---

## Phase 2 完成检查清单

```bash
npm run lint    # 0 errors
npm run build   # 成功
npm run test    # 校验测试通过
```

手动验收：
1. /create → 上传照片+高精度模式输入3500mm墙+6000mm深+2950mm层高
2. 提交 → 校验弹窗
3. 确认 → /layout-plan/{id}
4. 看到俯视图（空房间按比例）
5. 添加沙发3200mm → 色块出现 → 拖拽到墙边
6. 运行校验 → "沙发占墙宽91%，过大" block
7. 改为2600mm → 重新校验 → pass
8. 点击"生成效果图" → loading → "渲染引擎升级中"

**完整链路跑通即为Phase 2通过。**

---

## 给 Codex 的执行顺序

**先修Phase 1遗留warning：**
- PhotoUploadSection.tsx: `<img>` → `<Image>` (加 unoptimized)
- ReferenceUpload.tsx: 同上

然后：
1. **Task 2.1** → 校验引擎（纯逻辑+测试）
2. **Task 2.2** → 校验弹窗（集成到/create）
3. **Task 2.3** → 俯视布局图组件
4. **Task 2.4** → 家具输入面板
5. **Task 2.5** → 布局规划页（整合）
6. **Task 2.6** → 生成API骨架+loading更新
