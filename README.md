# Deklarado

A free PWA that checks trusted sources for class and work suspensions in Pampanga and sends push
notifications. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Folder guide

| Folder | What's inside |
|---|---|
| `src/app` | The app's pages (Next.js) |
| `src/data/areas.json` | Pampanga cities/towns with PSGC codes |
| `scripts/` | Helper scripts (e.g. rebuilding the area list) |
| `supabase/migrations` | Database tables — run once in Supabase |
| `supabase/seed` | Starting data (areas, sources) — run after the tables |
| `docs/` | Project plan and notes |

## First-time setup

1. Install [Node.js](https://nodejs.org) (LTS).
2. In this folder, run `npm install`.
3. Create a free [Supabase](https://supabase.com) project. In **SQL Editor**, run these files in order:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/seed/0001_areas.sql`
   3. `supabase/seed/0002_sources.sql`
4. Copy `.env.example` to `.env.local` and fill in the keys from **Project Settings → API**.
5. Run `npm run dev` and open http://localhost:3000.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on your computer |
| `npm run build` | Check that the app builds without errors |
| `node scripts/build-areas.mjs` | Rebuild the area list from the PSGC API |
