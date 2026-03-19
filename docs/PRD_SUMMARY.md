# HomeStylo MVP — Product Requirements Summary

> Condensed from MVP PRD V1.0 + Product Brief V4.1. Read this before any development task.

## One-Line Definition

A tool that helps Chinese families place real furniture candidates into photos of their own rooms before purchasing, enabling side-by-side comparison with size validation, risk warnings, and budget tracking.

## Core Slogan

买大件前，先放进你家看看 (Before buying big furniture, see it in your own home first)

## Target Users

1. **Existing home renovation** — Want to refresh living room/bedroom without major construction
2. **New apartment furnishing** — Developer-finished apartments that need all soft furnishings
3. **Store associates / stylists** — Help customers visualize candidates to close deals faster

## 6 MVP Modules (All P0)

### F1: Space Input & Analysis
- User uploads: room photo (required) + floor plan (optional)
- Room types: living room / bedroom / dining room
- AI analyzes walls (solid/window/door/opening), estimates dimensions
- User confirms/corrects wall properties and enters sofa wall width (required)
- Output: `structure_json` + `constraints_json` (max sofa width, max TV cabinet width, passage requirements)
- Cost: ~¥0.07/analysis (Claude Vision)

### F2: Smart Recommendation & Effect Image Generation
- User selects style + budget → system recommends product combination
- OR user imports their own candidates (primary flow in V4.1)
- Generation pipeline: Marigold depth → FLUX Depth Pro → GroundedSAM → FLUX Fill Pro → hotspot mapping
- Output: 1920×1080 effect image with clickable product hotspots
- Cost: ~¥3.16/full generation, ~30-45 seconds

### F3: Product Replacement & Comparison
- User imports candidates via: screenshot upload + manual size entry / Hero SKU selection / (P1: link parsing)
- Size validation before any replacement (must pass)
- Single replacement: SAM segment old → FLUX Fill new, ~¥0.56, ~5-10 seconds
- 3-way comparison page: side-by-side with price, size, risk warnings
- Risk engine outputs: gap warnings, passage width, proportion checks

### F4: Shopping List & Budget Tracking
- Full product list with: thumbnail, name, size, price, status (pending/purchased/abandoned)
- Budget dashboard: total budget, spent, remaining, item count
- Mark items as purchased with actual price
- Yellow warning at 80% budget, red at 100%

### F5: Scheme Management
- Save/load/copy/delete schemes
- Free users: max 3 schemes
- Each scheme = one room + one product combination + effect images + budget

### F6: Content Sharing
- 3 share formats: single effect image / shopping list / 3-way comparison
- Watermark: free users 70% opacity, paid users 20%
- Public share page at /s/[shareId] — no login required, read-only
- Save to phone album is the #1 sharing method

## User Flow

```
Landing Page → Upload Photo → Space Confirmation → Import Candidates (CORE ENTRY)
                                                         ↓
                                              ┌─── Has candidates? ───┐
                                              │ YES                    │ NO
                                              ↓                        ↓
                                     Generate Preview          Select Style
                                              ↓                        ↓
                                     Result + Hotspots         AI Recommends
                                              ↓                        ↓
                                     Replace / Compare    ←────────────┘
                                              ↓
                                     Budget Tracking → Share
```

## Pricing

| Tier | Price | Includes |
|------|-------|----------|
| Free preview | ¥0 | 1 low-res watermarked image |
| Single item trial | ¥9.9 | 1 item high-res preview |
| Room decision pack | ¥29.9 | 1 room, 3 candidates, basic accessories |
| Dual room pack | ¥59.9 | 2 rooms |

## North Star Metric

**Effective Decision Unit**: User uploads real room + imports real product + completes ≥1 comparison or replacement + saves/exports/clicks product.

## P0 Categories

**Large items**: sofa, bed, dining table, TV cabinet, curtain
**Accessories**: rug, floor lamp, painting, throw pillows, side table, plants
