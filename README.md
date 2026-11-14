# Deklarado

A free PWA that checks trusted sources for class and work suspensions in the Philippines and sends push
notifications. Coverage is hybrid: the whole country through national sources (GMA News, PAGASA, DepEd),
with Pampanga as the pilot area where LGU websites are also read. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Folder guide

| Folder | What's inside |
|---|---|
| `src/app` | The app's pages: Today (`page.tsx`), `calendar/`, `browse/`, `settings/`, and the `api/announcements` endpoint |
| `src/components` | Reusable pieces (status card, announcement card, area picker, navigation) |
| `src/lib` | App logic: areas and location, dates, suspension status rules, saved settings, demo data |
| `scanner/` | The automatic scanner (see below) |
| `src/data/areas.json` | All 1,734 areas (regions, provinces, Metro Manila, 1,634 cities/towns) with PSGC codes |
| `src/data/coordinates.json` | Center point of each city/town, for "Use my location" (on the device only) |
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
   3. `supabase/migrations/0003_reports_and_language.sql`
   4. `supabase/migrations/0004_calendar_reminders.sql`
   5. `supabase/seed/0001_areas.sql`
   6. `supabase/seed/0002_sources.sql`
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
| `node scripts/build-coordinates.mjs` | Look up missing town center points (OpenStreetMap, ~1 per second) |
| `node scripts/load-areas.mjs` | Load the area list into Supabase (same as running `supabase/seed/0001_areas.sql`) |
| `npm test` | Run all scanner tests |
| `npm run scan:dry` | Read all sources and show what the scanner finds, without saving |
| `node scanner/run.ts --dry --only rss` | Run one stage only (`gma`, `pagasa` or `rss`) |
| `node scanner/run.ts --dry --debug --days 14` | Show every GMA line it read (for checking the classifier) |
| `npm run scan` | Read all sources, save to Supabase, send notifications (needs `.env.local`) |

## The scanner

`scanner/run.ts` runs three independent stages — if one source is down, the others still run:

| Stage | Source | What it does |
|---|---|---|
| `gma` | GMA News Walang Pasok tracker | Reads suspension lists; `scanner/classify.ts` matches places anywhere in the Philippines (shared town names like "San Jose" need the province) |
| `pagasa` | PAGASA Tropical Cyclone Bulletins (PDF) | Works out the Wind Signal for every town in the country (`scanner/sources/pagasa.ts`) → `wind_signals` table |
| `rss` | Official websites: San Fernando, Angeles, Guagua, Lubao (pilot area), DepEd (nationwide) | Reads posts; `scanner/classify-post.ts` picks out suspension announcements |

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
a town's announcement goes to people in that town, a province's or region's to everyone in it, a
nationwide one to everyone — only if the school levels match. Each announcement is sent once.

## App features

| Feature | Where |
|---|---|
| **English / Filipino** | All text is in `src/lib/i18n.ts` (add every new key to both `en` and `fil`). Switch in Settings or on the welcome screen. Notifications are sent in the user's language. |
| **Share** | Each announcement card → Share (phone share sheet, or copies the text). `src/components/ShareButton.tsx` |
| **Report a mistake** | Each card → Report a mistake. Saved in the `reports` table (no personal data). Review them in Supabase → Table Editor → `reports` and set `status` to `confirmed` or `dismissed`. |
| **Philippine holidays** | `src/data/holidays.json` (2026: Proclamation No. 1006; 2027: Proclamation No. 1427). Shown on Today and the Calendar; night-before reminder at ~6 PM. **Add next year's dates every September** when the new Proclamation comes out; Eid dates are announced separately. |
| **School calendar from a photo** | Calendar → "Add school calendar from photo". Text is read on the phone (`tesseract.js`, no upload), turned into events by `src/lib/parseCalendar.ts`, and reviewed by the user before saving. Events are personal: saved on the phone, plus a private copy (`personal_events`, tied only to the phone's notification subscription) for night-before reminders. |
| **Night-before reminders** | `scanner/reminders.ts`, sent on the ~6 PM scan. Users can turn holiday / school-event reminders off in Settings. Test now with `node scanner/run.ts --reminders`. |
| **Works offline** | `public/sw.js` saves the pages and the latest announcements. With no signal, the app shows the saved copy with an "offline" notice. Test it with a production build (`npm run build` then `npm start`) — offline mode is not reliable in `npm run dev`. |

## Push notifications

- `public/sw.js` is the service worker that shows notifications (and handles offline mode).
- Settings → **Turn on notifications** saves the phone's subscription through `/api/push`.
- **Send a test** shows a sample notification right away (no server needed).
- On iPhone, notifications only work after **Share → Add to Home Screen** (iOS 16.4+).

You can also start it by hand: **Actions → Scan for suspensions → Run workflow**.
