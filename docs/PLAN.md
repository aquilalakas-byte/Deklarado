# Deklarado — Project Plan

A free Progressive Web App (PWA) that checks trusted sources every 3 hours for class and work
suspensions, shows them by date, time and area, and sends push notifications to users in the
affected area.

- **Type:** Capstone project
- **Pilot area:** Pampanga (City of San Fernando first), plus province-wide and national announcements
- **Cost:** ₱0 (free tiers only)
- **Runs on its own:** yes. No AI and no person needed once it is deployed.

---

## 1. How it works

```
[Sources] → [Scanner, every 3 hrs] → [Keyword classifier] → [Database] → [Push notification + App]
```

1. **Scanner** runs on a schedule (GitHub Actions), every 3 hours. It can run every hour when a
   typhoon signal is up.
2. **Keyword classifier** (rule-based, no AI) reads each new item and pulls out:
   - Whether it is a suspension
   - The place (city or municipality, plus province)
   - The levels covered (Kinder, Elementary, JHS, SHS, College, All levels, Government work)
   - Public, private, or both
   - The date and time covered
   - A link to the original source
3. **Database** (Supabase) stores the announcements, the source list and the push subscriptions.
4. **Notifier** sends a Web Push to every user subscribed to the affected city, province or nationwide.

## 2. Sources

| Priority | Source | How it is read | Role |
|---|---|---|---|
| 1 | **GMA News – Walang Pasok tracker** | Public JSON list + article page | Main source. Nationwide and updated overnight. |
| 2 | **PAGASA** | Typhoon bulletins | Signal levels → automatic DepEd suspension rules |
| 3 | **DepEd / PIA** | Website / RSS | National and regional announcements |
| 4 | **City / provincial websites** | WordPress RSS feed | Backup and official confirmation |

**GMA details**
- List: `https://data.gmanetwork.com/gno/widgets/grid_reverse_listing/keyword_walang_pasok/15.gz`
- Article lines follow this pattern: `Taal, Batangas - all levels, public and private`
- It is a news outlet, not a government source. The app labels it "Reported by GMA News" and links
  to the article.
- The JSON feed is unofficial. If it changes, the scanner falls back to reading the tracker page.

**City of San Fernando:** `https://cityofsanfernando.gov.ph/feed/`. Its RSS works, but the city posts
suspensions only on Facebook, so this is a secondary source.

**Out of scope:** reading Facebook pages directly. That needs Meta app review, so it is listed as a
future enhancement.

## 3. Features

| Feature | Description |
|---|---|
| Auto-location | GPS → city/municipality. Users can also pick a place manually. |
| Home screen | A big answer: **WALANG PASOK** / **MAY PASOK** / **No announcement yet**, with a source link |
| Filters | Date, time, region / province / city |
| Calendar | Monthly view with suspension days marked. Tap a day to see its announcements. |
| Notifications | Automatic Web Push. Users can choose which levels to be notified about. |
| History | Past announcements |

## 4. Tech stack (all free)

| Part | Tool |
|---|---|
| App (PWA) | Next.js / React, hosted on Vercel |
| Database | Supabase (Postgres) |
| Scheduled scanner | GitHub Actions cron |
| Push notifications | Web Push (VAPID) |
| Location | Browser geolocation + PSGC area list |

Notes:
- Supabase free projects pause after 1 week of no activity. The scanner keeps the project active.
- GitHub turns off scheduled jobs after 60 days with no repo activity. An occasional commit keeps them on.
- On iPhone, push only works after "Add to Home Screen" (iOS 16.4+). Android works right away.

## 5. Phases

| Phase | Work |
|---|---|
| 1. Foundation | Accounts (GitHub, Supabase, Vercel), project setup, database tables, Pampanga area list |
| 2. Scanner | GMA reader, keyword classifier, city RSS reader, scheduled job |
| 3. App | Home screen, location, filters, history |
| 4. Calendar + notifications | Calendar view, Web Push, notification preferences |
| 5. Extra sources | PAGASA signal rules, DepEd/PIA, more Pampanga LGUs |

## 6. Limitations / future enhancements (for the paper)

- Facebook pages are not read directly (needs Meta API approval).
- GMA is a news source and may report later than the LGU's own post.
- The keyword classifier can miss unusually worded announcements. An AI classifier could replace it later.
- Scrapers can break when a website changes its layout.
