# HomeStylo - Codex Agent Instructions

## Project Overview

HomeStylo is an AI-powered soft furnishing decision platform. It helps homeowners who have completed hard decoration (精装房 / 翻新) make every soft furnishing purchase decision based on their real home.

Core flow: User uploads photos of their real home -> AI analyzes space (dimensions, wall color, floor material, lighting) -> Sets budget -> AI recommends a complete furnishing plan within budget -> Each item shown at precise scale in the user's own photo -> User can lock their own picks, AI adjusts remaining items to fit remaining budget -> Home state persists and evolves with each purchase.

Key differentiator: Unlike tools that work from floor plans (酷家乐 / 生境 AI), HomeStylo works from real photos - preserving the user's actual wall colors, floor textures, and lighting conditions. The output looks like "your home with new furniture" not "a virtual showroom."

This is NOT a one-time design tool. It is a **persistent home platform** where the user's home lives and evolves over their 3-6 month furnishing period.

## Tech Stack

- **Framework**: Next.js 16 with App Router, TypeScript, `src/` directory
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Object Storage**: Cloudflare R2 (for effect images and product images)
- **AI Generation**: Replicate API (UniDepthV2, VGGT, BiRefNet, SAM 3, IC-Light V2, FLUX Fill Pro)
- **AI Analysis**: Anthropic Claude API (Vision for space analysis, product image classification)
- **Deployment**: Vercel
- **Package Manager**: npm

## Core Data Model

```text
Home (用户的家)
├── Room (房间)[]
│   ├── original_photo (首次上传的照片)
│   ├── current_photo (最新状态照片)
│   ├── spatial_analysis (AI 空间分析结果)
│   └── FurnishingPlan (软装清单)[]
│       ├── total_budget (总预算)
│       ├── items[] (商品列表，每件有 locked/unlocked 状态)
│       └── EffectImage[] (效果图)
```

Home is the top-level persistent entity. Scheme (from V3.1) is deprecated - use Room + FurnishingPlan instead.

## Rendering Pipeline (Route D)

Paste-and-blend with edge inpainting:
1. Product image preprocessing (classify + extract via BiRefNet/SAM3)
2. Room depth analysis (UniDepthV2 + VGGT, cached per room photo)
3. Precise compositing (math-based scale + OpenCV perspective + alpha blend)
4. Edge refinement (edge+shadow mask -> IC-Light -> FLUX Fill inpaint only edges, furniture body untouched)

Key principle: **Furniture pixels are NEVER modified. AI only refines edges and shadows.**

## Project Structure

```text
homestylo/
├── AGENTS.md
├── docs/
│   ├── PRD_SUMMARY.md
│   ├── DESIGN_SYSTEM.md
│   ├── DATABASE_SCHEMA.sql
│   └── PHASE_7_TASKS.md          # Current phase
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx             # Root layout
│   │   ├── login/                 # Auth
│   │   ├── dashboard/             # User's homes list
│   │   ├── home/[homeId]/         # Home overview (rooms list)
│   │   ├── room/[roomId]/         # Room detail + furnishing plan
│   │   ├── furnishing/[planId]/   # Furnishing cart UI
│   │   ├── generate/[planId]/     # Generation progress
│   │   ├── result/[planId]/       # Effect image + hotspots
│   │   └── api/
│   │       ├── home/              # Home CRUD
│   │       ├── room/analyze/      # Space analysis
│   │       ├── furnishing/        # Plan CRUD, budget adjustment
│   │       ├── generate/          # Effect image generation
│   │       ├── product/           # Product import, validate
│   │       └── recommend/         # AI furniture recommendation
│   ├── components/
│   │   ├── ui/                    # shadcn/ui
│   │   ├── home/                  # Home-related components
│   │   ├── furnishing/            # Furnishing cart components
│   │   ├── generate/              # Loading + progressive preview
│   │   └── result/                # Effect image display
│   └── lib/
│       ├── supabase/              # DB clients
│       ├── store/
│       │   ├── homeStore.ts       # Home + Room state
│       │   └── furnishingStore.ts # Furnishing plan state
│       ├── api/                   # External API wrappers
│       ├── types/index.ts         # All TypeScript types
│       ├── generation/            # Rendering pipeline (Route D)
│       ├── validation/            # Size validation engine
│       ├── recommendation/        # AI recommendation + budget allocation
│       └── constants.ts
```

## Coding Conventions

- TypeScript strict mode
- Mobile-first responsive design
- **UI text: bilingual (English primary, Chinese secondary)**
- Code comments in English
- File names kebab-case, components PascalCase
- `'use client'` only when needed, prefer Server Components
- Tailwind CSS + shadcn/ui, no custom CSS files
- Zustand for client state, Supabase for persistence
- API routes return `{ success: boolean, data?: any, error?: string }`
- Git commit format: `phase-X/task-Y: brief description`

## Key Product Decisions

1. **Home is the top-level entity**, not Scheme
2. Furnishing Cart (软装清单) is budget-aware: user sets total budget, AI allocates across categories
3. User-uploaded products are automatically locked; AI-recommended products are unlocked and can be swapped when budget changes
4. Effect images use Route D: precise paste-and-blend + edge-only AI inpainting
5. Progressive rendering: rough composite in <5s, refined version in 25-40s
6. Size validation is MANDATORY before placement
7. Support both US market (Amazon/Wayfair, USD, English) and CN market (Taobao/JD, RMB, Chinese)
