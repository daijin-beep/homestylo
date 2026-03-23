# V4.0 Migration Guide

## New tables
- `homes` - top-level entity representing a user's home
- `rooms` - rooms within a home, with photos and spatial analysis
- `furnishing_plans` - budget-aware furnishing carts per room
- `furnishing_plan_items` - individual items in a plan (AI recommended or user uploaded)

## Relationship to V3.1 tables
- `schemes` table is NOT deleted but deprecated. New code should use rooms + furnishing_plans.
- `room_analysis` table is NOT deleted. Its functionality is absorbed into rooms.spatial_analysis.
- `scheme_products` table is NOT deleted. New code should use furnishing_plan_items.
- `effect_images` now has an optional plan_id column linking to furnishing_plans.

## Migration steps
1. Run `supabase/migrations/v4_home_furnishing.sql` in Supabase SQL Editor
2. Existing data in schemes/room_analysis/scheme_products remains untouched
3. New features use the new tables exclusively
