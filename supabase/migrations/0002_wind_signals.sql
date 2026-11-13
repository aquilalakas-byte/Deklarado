-- Deklarado — PAGASA Wind Signals (run after 0001_init.sql)

-- The current Wind Signal for each town. One row per town; level 0 = no signal.
create table if not exists wind_signals (
  area_code      text primary key references areas(code),
  level          smallint not null default 0 check (level between 0 and 5),
  storm          text,                 -- e.g. 'Typhoon ROSAL (CHAMPI)'
  bulletin_no    text,                 -- e.g. '10'
  issued         text,                 -- as written by PAGASA, e.g. '5:00 PM, 22 October 2026'
  bulletin_url   text,
  notified_level smallint not null default 0, -- highest level users were already alerted about
  updated_at     timestamptz not null default now()
);

alter table wind_signals enable row level security;
drop policy if exists "public read wind_signals" on wind_signals;
create policy "public read wind_signals" on wind_signals for select using (true);
-- (PAGASA itself is added as a source in supabase/seed/0002_sources.sql)
