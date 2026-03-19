# HomeStylo

**买大件前，先放进你家看看**

AI-powered furniture decision tool for the Chinese market. Upload your room, import furniture candidates you're considering, and see them placed in your actual space with size validation, risk warnings, and budget tracking.

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)
- Cloudflare R2 (image storage)
- Replicate (FLUX, SAM, Marigold)
- Anthropic Claude (Vision API)
- Vercel (deployment)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Fill in your API keys
npm run dev
```

## Project Structure

See `AGENTS.md` for full architecture and coding conventions.

## Documentation

- `docs/PRD_SUMMARY.md` — Product requirements
- `docs/DESIGN_SYSTEM.md` — Design knowledge base
- `docs/DATABASE_SCHEMA.sql` — Database schema
- `docs/PHASE_X_TASKS.md` — Development task cards
