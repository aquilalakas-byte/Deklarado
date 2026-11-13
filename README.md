# Deklarado

A free PWA that checks trusted sources for class and work suspensions in Pampanga and sends push
notifications. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Folder guide

| Folder | What's inside |
|---|---|
| `src/app` | The app's pages: Today (`page.tsx`), `calendar/`, `browse/`, `settings/`, and the `api/announcements` endpoint |
| `src/components` | Reusable pieces (status card, announcement card, area picker, navigation) |
| `src/lib` | App logic: areas and location, dates, suspension status rules, saved settings, demo data |
| `scanner/` | The automatic scanner (see below) |
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
   2. `supabase/migrations/0002_wind_signals.sql`
   3. `supabase/seed/0001_areas.sql`
   4. `supabase/seed/0002_sources.sql`
4. Copy `.env.example` to `.env.local` and fill in the keys from **Project Settings → API**.
5. Run `npm run dev` and open http://localhost:3000.

**Demo mode:** until `.env.local` has real Supabase keys, the app shows sample announcements with a
"Demo data" banner, so you can try every screen without a database.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on your computer |
| `npm run build` | Check that the app builds without errors |
| `node scripts/build-areas.mjs` | Rebuild the area list from the PSGC API |
| `npm test` | Run all scanner tests |
| `npm run scan:dry` | Read all sources and show what the scanner finds, without saving |
| `node scanner/run.ts --dry --only rss` | Run one stage only (`gma`, `pagasa` or `rss`) |
| `node scanner/run.ts --dry --debug --days 14` | Show every GMA line it read (for checking the classifier) |
| `npm run scan` | Read all sources, save to Supabase, send notifications (needs `.env.local`) |

## The scanner

`scanner/run.ts` runs three independent stages — if one source is down, the others still run:

| Stage | Source | What it does |
|---|---|---|
| `gma` | GMA News Walang Pasok tracker | Reads suspension lists; `scanner/classify.ts` finds Pampanga entries |
| `pagasa` | PAGASA Tropical Cyclone Bulletins (PDF) | Works out the Wind Signal for each town (`scanner/sources/pagasa.ts`) → `wind_signals` table |
| `rss` | Official websites: San Fernando, Angeles, Guagua, Lubao, DepEd | Reads posts; `scanner/classify-post.ts` picks out suspension announcements |

Website list: `scanner/sources/registry.ts` (keep in sync with `supabase/seed/0002_sources.sql`).
Some sites can't be read automatically — Mabalacat, Apalit, DepEd Region III, PIA (blocked by bot
protection) and the Province of Pampanga site (no usable feed). Deklarado does not get around bot protection.

**Wind Signals and Executive Order 130:** a signal is shown as a weather alert only. EO 130 (Oct 2026)
replaced the old automatic suspension-by-signal rules; DepEd will publish new thresholds. When it does,
fill in `scanner/rules.ts` and signals will automatically create suspension announcements.

It runs automatically every 3 hours with GitHub Actions (`.github/workflows/scan.yml`). For that to work,
add these secrets in **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**
(same values as in `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for notifications)

After saving, the scanner sends push notifications for new announcements (`scanner/notify.ts`):
a town's announcement goes to people in that town, a province's to everyone in the province, a
nationwide one to everyone — only if the school levels match. Each announcement is sent once.

## Push notifications

- `public/sw.js` is the service worker that shows notifications.
- Settings → **Turn on notifications** saves the phone's subscription through `/api/push`.
- **Send a test** shows a sample notification right away (no server needed).
- On iPhone, notifications only work after **Share → Add to Home Screen** (iOS 16.4+).

You can also start it by hand: **Actions → Scan for suspensions → Run workflow**.
