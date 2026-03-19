# HomeStylo — Codex Agent Instructions

## Project Overview

HomeStylo is an AI-powered furniture decision tool for the Chinese market. Core value proposition: "买大件前，先放进你家看看" (Before buying big furniture, see it in your own home first).

Users upload a photo of their room → import candidate furniture they're considering → AI generates realistic preview images showing the furniture in their actual space → users compare 3 candidates side-by-side with size validation and risk warnings → export shopping list with budget tracking.

This is NOT a general interior design platform. It is a **purchase decision tool** focused on reducing the risk of buying wrong large furniture items.

## Tech Stack

- **Framework**: Next.js 14 with App Router, TypeScript, `src/` directory
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Object Storage**: Cloudflare R2 (for effect images and product images)
- **AI Generation**: Replicate API (FLUX Depth Pro, FLUX Fill Pro, GroundedSAM, Marigold)
- **AI Analysis**: Anthropic Claude API (Vision for space analysis, hotspot mapping)
- **Deployment**: Vercel (Hong Kong region)
- **Package Manager**: npm

## Project Structure

```
homestylo/
├── AGENTS.md                    # This file — Codex reads this automatically
├── docs/
│   ├── PRD_SUMMARY.md           # Product requirements summary
│   ├── DESIGN_SYSTEM.md         # Design knowledge base for FLUX prompts
│   ├── DATABASE_SCHEMA.sql      # Supabase table definitions
│   └── PHASE_0_TASKS.md         # Current phase task cards
├── src/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── layout.tsx           # Root layout with AuthProvider
│   │   ├── login/page.tsx       # Phone OTP login
│   │   ├── dashboard/page.tsx   # User's scheme list
│   │   ├── upload/page.tsx      # Room photo upload
│   │   ├── analyze/[schemeId]/page.tsx    # Space analysis + confirmation
│   │   ├── import/[schemeId]/page.tsx     # Candidate product import (CORE ENTRY)
│   │   ├── style/[schemeId]/page.tsx      # Style selection (fallback path)
│   │   ├── generate/[schemeId]/page.tsx   # Generation progress
│   │   ├── result/[schemeId]/page.tsx     # Effect image + hotspots
│   │   ├── compare/[schemeId]/page.tsx    # 3-way comparison
│   │   ├── accounting/[schemeId]/page.tsx # Budget tracking
│   │   ├── share/[schemeId]/page.tsx      # Share generation
│   │   ├── s/[shareId]/page.tsx           # Public share view (no auth)
│   │   ├── pricing/page.tsx               # Pricing page
│   │   ├── admin/products/page.tsx        # SKU management
│   │   └── api/
│   │       ├── room/analyze/route.ts
│   │       ├── scheme/recommend/route.ts
│   │       ├── scheme/generate/route.ts
│   │       ├── scheme/replace/route.ts
│   │       ├── product/validate/route.ts
│   │       ├── product/import-screenshot/route.ts
│   │       └── share/generate/route.ts
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── AuthProvider.tsx
│   │   ├── SchemeNavigation.tsx  # Progress bar across scheme pages
│   │   ├── ProductCard.tsx
│   │   ├── HotspotOverlay.tsx
│   │   ├── RiskAlert.tsx
│   │   ├── BudgetProgress.tsx
│   │   └── LoadingGeneration.tsx
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts        # Browser-side Supabase client
│       │   └── server.ts        # Server-side Supabase client
│       ├── store/
│       │   ├── schemeStore.ts   # Main Zustand store
│       │   └── userStore.ts
│       ├── api/
│       │   ├── replicate.ts     # Replicate API wrapper with polling
│       │   ├── claude.ts        # Claude Vision API wrapper
│       │   └── r2.ts            # R2 upload/download wrapper
│       ├── types/index.ts       # All TypeScript type definitions
│       ├── constants.ts         # Style definitions, budget tiers, categories
│       └── utils.ts             # Common utilities
```

## Coding Conventions

### General Rules
- Always use TypeScript with strict mode
- Mobile-first responsive design — always test at 375px width mentally
- All UI text in Chinese (zh-CN) — button labels, placeholders, error messages, everything user-facing
- Code comments in English
- File names in kebab-case, component names in PascalCase
- Use `'use client'` directive only when the component needs client-side interactivity
- Prefer Server Components by default

### Styling Rules
- Use Tailwind CSS utility classes, no custom CSS files
- Use shadcn/ui components for forms, dialogs, buttons, cards
- Brand colors defined in tailwind.config.ts:
  - primary: `#8B5A37` (warm brown)
  - background: `#F5F0E9` (cream)
  - foreground: `#2B3A4A` (dark blue-gray)
  - accent: `#E07B3C` (warm orange)
- Touch targets minimum 48px on mobile
- Font: Noto Sans SC (body), Noto Serif SC (headings) from Google Fonts

### State Management
- Use the Zustand store at `src/lib/store/schemeStore.ts` for all scheme-related state
- Do NOT create separate useState for data that belongs in the store
- Always update store when Supabase data changes

### API Routes
- All API routes at `src/app/api/` use Route Handlers (export async function POST/GET)
- Always validate input at the start of each route
- Return consistent JSON shape: `{ success: boolean, data?: any, error?: string }`
- Use try-catch with meaningful error messages
- For long-running operations (image generation), use async pattern:
  1. POST creates a job and returns job_id immediately
  2. GET `/api/.../status?id=xxx` for polling

### Supabase Rules
- Always use the client from `src/lib/supabase/client.ts` (browser) or `server.ts` (API routes)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- All queries on user-owned data must filter by user_id (RLS handles this, but be explicit)
- Use Supabase Auth Phone OTP for login

### Replicate API
- Always use the wrapper at `src/lib/api/replicate.ts`
- Default timeout: 90 seconds
- Polling interval: 2 seconds
- Max retries on timeout: 2
- Handle cold-start delays gracefully with user-facing progress messages

### Git Workflow
- Commit after each completed task
- Commit message format: `phase-X/task-Y: brief description`
- Push at end of each work session

## Key Product Decisions

1. **Main flow is "import your candidate → preview → compare"**, NOT "pick a style → AI recommends"
2. Style selection is a fallback path when user has no candidates
3. Maximum 3 candidates for comparison per furniture category
4. Size validation is MANDATORY before any replacement generation
5. Risk warnings must be shown for: tight gaps (<100mm), narrow passages (<600mm), oversized furniture
6. Free tier: 1 low-res watermarked image. Paid tiers: ¥9.9 / ¥29.9 / ¥59.9
7. MVP categories (P0): sofa, bed, dining table, TV cabinet, curtain + accessories (rug, floor lamp, painting, pillows, side table, plants)
8. All product links point to Taobao/JD (Chinese e-commerce)

## Files to Read

Before starting any task, read these files for context:
- `docs/PRD_SUMMARY.md` — Product requirements
- `docs/DESIGN_SYSTEM.md` — Design knowledge for style/color decisions
- `docs/DATABASE_SCHEMA.sql` — Database structure
- Current phase task cards in `docs/PHASE_X_TASKS.md`

## Testing

- Run `npm run lint` before committing
- Run `npm run build` to check for TypeScript errors
- Test all pages at mobile width (375px) and desktop (1440px)
- Test the happy path end-to-end after completing each phase
