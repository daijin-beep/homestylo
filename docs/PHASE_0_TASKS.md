# Phase 0 Task Cards — Environment + Scaffold + Auth

> Give these tasks to Codex one at a time, in order.
> Each task is self-contained. Commit after each.

---

## Task 0.1: Create Next.js Project

**Objective**: Initialize the project with all dependencies.

**Instructions**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install @supabase/supabase-js @supabase/ssr zustand framer-motion lucide-react react-dropzone sharp
npx shadcn@latest init
```

When running `shadcn init`, select:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

Then install shadcn components we'll need:
```bash
npx shadcn@latest add button card dialog input label radio-group select tabs toast
```

Create `.env.local` with placeholder values:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REPLICATE_API_TOKEN=your_replicate_token
ANTHROPIC_API_KEY=your_anthropic_key
R2_ACCESS_KEY_ID=your_r2_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_ENDPOINT=your_r2_endpoint
R2_BUCKET_NAME=homestylo-assets
```

Update `tailwind.config.ts` to add brand colors:
```typescript
// Extend the theme with HomeStylo brand colors:
// primary: { DEFAULT: '#8B5A37', foreground: '#FFFFFF' }
// background: '#F5F0E9'
// foreground: '#2B3A4A'
// accent: { DEFAULT: '#E07B3C', foreground: '#FFFFFF' }
// warning: '#F59E0B'
// danger: '#EF4444'
```

Add Google Fonts (Noto Sans SC + Noto Serif SC) in `src/app/layout.tsx`.

**Verify**: `npm run dev` shows the default Next.js page with no errors.

**Commit**: `phase-0/task-1: initialize next.js project with dependencies`

---

## Task 0.2: Supabase Client Setup + Auth

**Objective**: Set up Supabase clients and phone OTP login.

**Instructions**:

Create `src/lib/supabase/client.ts`:
- Browser-side Supabase client singleton using `createBrowserClient` from `@supabase/ssr`
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Create `src/lib/supabase/server.ts`:
- Server-side client using `createServerClient` from `@supabase/ssr` with cookies
- For use in Server Components and API routes

Create `src/lib/supabase/middleware.ts`:
- Supabase middleware helper for refreshing auth session

Create `src/middleware.ts`:
- Protect these routes (redirect to /login if not authenticated): `/dashboard`, `/upload`, `/analyze`, `/import`, `/style`, `/generate`, `/result`, `/compare`, `/accounting`, `/share`, `/admin`
- Allow these routes without auth: `/`, `/login`, `/s/[shareId]`, `/pricing`
- After refreshing session, if user tries to access protected route while unauthenticated, redirect to `/login?redirect=<original_path>`

Create `src/components/AuthProvider.tsx`:
- Client component that wraps the app
- Listens to Supabase auth state changes
- Provides auth context (or just let components use supabase client directly)

Create `src/app/login/page.tsx`:
- Mobile-first phone login page
- Phone number input with China country code (+86) prefix
- "获取验证码" (Get verification code) button with 60-second countdown after click
- 6-digit verification code input
- "登录" (Login) button
- On successful login, redirect to the `redirect` query param or `/dashboard`
- All text in Chinese
- Use Supabase Auth `signInWithOtp({ phone })`  and `verifyOtp({ phone, token, type: 'sms' })`
- Error handling: show toast for invalid code, network errors

Update `src/app/layout.tsx`:
- Wrap children with AuthProvider
- Set metadata: title "HomeStylo — 买大件前，先放进你家看看"

**Verify**: Login page renders, phone input works, sends OTP (test with Supabase test phone number if available).

**Commit**: `phase-0/task-2: supabase auth setup with phone OTP login`

---

## Task 0.3: TypeScript Types + Constants

**Objective**: Define all shared types and constants used across the app.

**Instructions**:

Create `src/lib/types/index.ts` with these types:
```typescript
// Room and style types
export type RoomType = 'living_room' | 'bedroom' | 'dining_room';
export type StyleType = 'midcentury' | 'song' | 'cream_french' | 'wabi_sabi' | 'dopamine';
export type BudgetTier = 'economy' | 'quality' | 'premium' | 'custom';
export type ProductCategory = 'sofa' | 'coffee_table' | 'tv_cabinet' | 'bed' | 'dining_table' | 'curtain' | 'rug' | 'floor_lamp' | 'painting' | 'pillow' | 'side_table' | 'plant';
export type SchemeStatus = 'draft' | 'analyzing' | 'importing' | 'generating' | 'completed';
export type ProductRole = 'primary' | 'secondary' | 'accessory';
export type GenerationStatus = 'pending' | 'depth' | 'flux' | 'sam' | 'fill' | 'hotspot' | 'done' | 'failed';
export type ProductImportSource = 'screenshot' | 'hero_sku' | 'link' | 'recommendation';
export type ProductStatus = 'recommended' | 'candidate' | 'confirmed' | 'purchased' | 'abandoned';
export type ShareType = 'single' | 'list' | 'compare';
export type PlanType = 'free' | 'single' | 'room' | 'dual';

// Database row interfaces (match Supabase tables exactly)
export interface User {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar_url: string | null;
  plan_type: PlanType;
  generation_count: number;
  created_at: string;
  updated_at: string;
}

export interface Scheme {
  id: string;
  user_id: string;
  room_type: RoomType;
  style: StyleType | null;
  budget_min: number | null;
  budget_max: number | null;
  status: SchemeStatus;
  created_at: string;
  updated_at: string;
}

export interface RoomAnalysis {
  id: string;
  scheme_id: string;
  photo_url: string;
  floor_plan_url: string | null;
  structure_json: SpaceStructure | null;
  constraints_json: FurnitureConstraints | null;
  user_confirmed: boolean;
  created_at: string;
}

export interface EffectImage {
  id: string;
  scheme_id: string;
  image_url: string;
  hotspot_map: Hotspot[] | null;
  generation_params: Record<string, unknown> | null;
  generation_status: GenerationStatus;
  error_message: string | null;
  version: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  style: StyleType | 'universal';
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  image_url: string;
  source_url: string | null;
  brand: string | null;
  tags: string[];
  is_hero: boolean;
  created_at: string;
}

export interface SchemeProduct {
  id: string;
  scheme_id: string;
  product_id: string | null;
  role: ProductRole;
  category: string;
  is_user_imported: boolean;
  import_source: ProductImportSource | null;
  custom_name: string | null;
  custom_image_url: string | null;
  custom_width_mm: number | null;
  custom_depth_mm: number | null;
  custom_height_mm: number | null;
  custom_price: number | null;
  status: ProductStatus;
  actual_price: number | null;
  purchased_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Share {
  id: string;
  scheme_id: string;
  share_type: ShareType;
  image_url: string | null;
  view_count: number;
  created_at: string;
}

// Computed / nested types
export interface SpaceStructure {
  walls: WallInfo[];
  shooting_direction: string;
  confidence: number;
}

export interface WallInfo {
  id: string;
  type: 'solid_wall' | 'window' | 'door' | 'opening';
  estimated_width_mm: number;
  label?: string;
}

export interface FurnitureConstraints {
  sofa_wall_width_mm: number;
  tv_wall_width_mm: number;
  room_depth_mm: number | null;
  max_sofa_width_mm: number;
  max_tv_cabinet_width_mm: number;
}

export interface Hotspot {
  product_id: string;
  label: string;
  x: number;  // percentage 0-100
  y: number;  // percentage 0-100
  width: number;  // percentage
  height: number; // percentage
}

export interface ValidationResult {
  valid: boolean;
  risks: RiskItem[];
  metrics: {
    remaining_gap_mm: number | null;
    passage_width_mm: number | null;
    wall_ratio_percent: number | null;
  };
}

export interface RiskItem {
  type: 'block' | 'warning' | 'info';
  message: string;
  detail: string;
}
```

Create `src/lib/constants.ts`:
```typescript
// Style definitions with Chinese labels, colors, and FLUX prompt keywords
// Budget tier definitions: economy (0-20000), quality (20000-50000), premium (50000+)
// Product category definitions grouped by role (primary/secondary/accessory)
// Room type definitions with Chinese labels

// Include FLUX_PROMPTS: Record<StyleType, string> with the prompt templates from docs/DESIGN_SYSTEM.md
```

Create `src/lib/utils.ts`:
- `formatPrice(cents: number): string` — format as ¥X,XXX
- `formatDimension(mm: number): string` — format as X.Xm or Xcm
- `cn(...classes: string[]): string` — Tailwind class merger (use clsx + tailwind-merge)

**Verify**: `npm run build` passes with no TypeScript errors.

**Commit**: `phase-0/task-3: type definitions and constants`

---

## Task 0.4: Zustand Store + API Wrappers

**Objective**: Set up global state management and external API client wrappers.

**Instructions**:

Create `src/lib/store/schemeStore.ts`:
```typescript
// Zustand store managing the current active scheme
// State:
//   currentScheme: Scheme | null
//   roomAnalysis: RoomAnalysis | null
//   candidateProducts: SchemeProduct[] — user-imported candidates (max 3 per category)
//   schemeProducts: SchemeProduct[] — all products in the scheme
//   effectImages: EffectImage[]
//   isLoading: boolean
//   currentStep: 'upload' | 'analyze' | 'import' | 'style' | 'generate' | 'result' | 'compare' | 'accounting'
//
// Actions:
//   setScheme(scheme: Scheme)
//   setRoomAnalysis(analysis: RoomAnalysis)
//   addCandidate(product: SchemeProduct)
//   removeCandidate(productId: string)
//   setSchemeProducts(products: SchemeProduct[])
//   addEffectImage(image: EffectImage)
//   updateEffectImage(id: string, updates: Partial<EffectImage>)
//   setStep(step)
//   setLoading(loading: boolean)
//   reset()
```

Create `src/lib/store/userStore.ts`:
```typescript
// Zustand store for user state
// State:
//   user: User | null
//   isAuthenticated: boolean
// Actions:
//   setUser(user: User | null)
//   updatePlan(plan: PlanType)
```

Create `src/lib/api/replicate.ts`:
```typescript
// Replicate API wrapper
// export async function runPrediction(model: string, input: Record<string, unknown>, timeoutMs = 90000): Promise<unknown>
// 1. POST to https://api.replicate.com/v1/predictions with { model, input }
// 2. Poll GET /predictions/{id} every 2 seconds
// 3. If status === 'succeeded', return output
// 4. If status === 'failed', throw with error message
// 5. If timeout exceeded, throw timeout error
// 6. Uses REPLICATE_API_TOKEN from env (server-side only)
```

Create `src/lib/api/claude.ts`:
```typescript
// Claude Vision API wrapper
// export async function analyzeImage(imageUrl: string, systemPrompt: string, userPrompt: string): Promise<string>
// Uses ANTHROPIC_API_KEY from env
// Model: claude-sonnet-4-20250514
// Sends image as URL, returns text response
// Timeout: 30 seconds
```

Create `src/lib/api/r2.ts`:
```typescript
// Cloudflare R2 wrapper (S3-compatible)
// export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string>
// export function getR2Url(key: string): string
// Uses R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME from env
// Returns the public URL of the uploaded object
// Uses @aws-sdk/client-s3 — install it: npm install @aws-sdk/client-s3
```

**Verify**: `npm run build` passes. Import the stores and API wrappers without errors.

**Commit**: `phase-0/task-4: zustand stores and API wrappers`

---

## Task 0.5: Page Scaffolding + Navigation

**Objective**: Create all page files as placeholders with proper routing.

**Instructions**:

Create all page files listed in AGENTS.md project structure. Each placeholder page should contain:
- The page title in Chinese as an h1
- A "返回" (back) button that navigates to the previous step
- SchemeNavigation component showing current step (for scheme pages)

Create `src/components/SchemeNavigation.tsx`:
- A horizontal step indicator showing: 上传 → 分析 → 导入 → 风格 → 生成 → 结果 → 对比 → 记账
- Current step highlighted in primary color
- Completed steps show checkmark
- Mobile: horizontal scroll if needed

Create `src/app/dashboard/page.tsx`:
- Empty state with illustration placeholder and CTA button "开始你的第一个方案" → links to /upload
- Will be filled in Phase 4

Verify all routes work:
- `/` — landing (placeholder)
- `/login` — login page (from Task 0.2)
- `/dashboard` — scheme list
- `/upload` — upload page
- `/analyze/test-id` — analysis page
- `/import/test-id` — import page
- `/style/test-id` — style page
- `/generate/test-id` — generation page
- `/result/test-id` — result page
- `/compare/test-id` — compare page
- `/accounting/test-id` — accounting page
- `/share/test-id` — share page
- `/s/test-id` — public share (no auth required)
- `/pricing` — pricing (no auth required)

**Verify**: All routes render without errors. Navigation between steps works.

**Commit**: `phase-0/task-5: page scaffolding with navigation`

---

## Phase 0 Complete Checklist

After all 5 tasks, verify:
- [ ] `npm run dev` runs without errors
- [ ] `npm run build` succeeds
- [ ] Login page works (renders correctly, OTP flow works if Supabase phone auth configured)
- [ ] All routes accessible, protected routes redirect to login
- [ ] Dashboard shows empty state
- [ ] SchemeNavigation renders on scheme pages
- [ ] TypeScript types compile cleanly
- [ ] Zustand stores can be imported without errors
- [ ] All files committed and pushed to GitHub

**Then**: Tell Kim (the PM) that Phase 0 is complete, and ask for Phase 1 task cards.
