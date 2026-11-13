-- Deklarado — initial database schema
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.

-- ─────────────────────────────────────────────────────────────
-- 1. AREAS: places the app knows about (national → region → province → city/municipality)
--    Codes are PSGC codes (Philippine Standard Geographic Code).
-- ─────────────────────────────────────────────────────────────
create table if not exists areas (
  code        text primary key,                 -- e.g. '035416000' = City of San Fernando
  name        text not null,                    -- official name
  type        text not null check (type in ('national', 'region', 'province', 'city', 'municipality')),
  parent_code text references areas(code),      -- city → province → region → national
  aliases     text[] not null default '{}',     -- other spellings used in posts, e.g. 'CSFP', 'San Fernando'
  created_at  timestamptz not null default now()
);

create index if not exists areas_parent_idx on areas(parent_code);

-- ─────────────────────────────────────────────────────────────
-- 2. SOURCES: where the scanner looks
-- ─────────────────────────────────────────────────────────────
create table if not exists sources (
  id              bigint generated always as identity primary key,
  name            text not null,                -- e.g. 'GMA News – Walang Pasok'
  kind            text not null check (kind in ('gma', 'rss', 'pagasa', 'deped', 'pia')),
  url             text not null unique,
  area_code       text references areas(code),  -- null = covers many areas (e.g. GMA)
  is_official     boolean not null default false, -- true = government source, false = news
  active          boolean not null default true,
  last_checked_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. RAW ITEMS: every post/article the scanner fetched (so nothing is processed twice)
-- ─────────────────────────────────────────────────────────────
create table if not exists raw_items (
  id           bigint generated always as identity primary key,
  source_id    bigint not null references sources(id) on delete cascade,
  external_id  text not null,                   -- the source's own ID or URL
  title        text,
  url          text,
  content      text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  updated_hash text,                            -- changes when an article is updated, so we re-read it
  unique (source_id, external_id)
);

-- ─────────────────────────────────────────────────────────────
-- 4. ANNOUNCEMENTS: what the keyword classifier found (this is what users see)
-- ─────────────────────────────────────────────────────────────
create table if not exists announcements (
  id           bigint generated always as identity primary key,
  raw_item_id  bigint references raw_items(id) on delete cascade,
  area_code    text not null references areas(code),
  kind         text not null check (kind in ('class_suspension', 'work_suspension', 'holiday', 'resumption')),
  levels       text[] not null default '{all}',  -- 'kinder','elementary','jhs','shs','college','all'
  sector       text not null default 'both' check (sector in ('public', 'private', 'both')),
  date_covered date not null,                   -- the day with no classes
  starts_at    time,                            -- null = whole day; e.g. '12:00' for afternoon only
  reason       text,                            -- e.g. 'Typhoon', 'Power interruption'
  summary      text not null,                   -- the original line, e.g. 'Taal, Batangas - all levels, public and private'
  source_name  text not null,
  source_url   text not null,
  is_official  boolean not null default false,
  notified_at  timestamptz,                     -- set after push notifications are sent
  created_at   timestamptz not null default now(),
  unique (raw_item_id, area_code, date_covered)
);

create index if not exists announcements_area_date_idx on announcements(area_code, date_covered);
create index if not exists announcements_date_idx on announcements(date_covered);

-- ─────────────────────────────────────────────────────────────
-- 5. PUSH SUBSCRIPTIONS: browsers that want notifications
-- ─────────────────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id         bigint generated always as identity primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  area_code  text not null references areas(code),   -- the user's city/municipality
  levels     text[] not null default '{all}',         -- which levels they care about
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Security (Row Level Security)
-- Anyone can READ areas, sources and announcements.
-- Only the server (service role key) can WRITE. Push subscriptions are never public.
-- ─────────────────────────────────────────────────────────────
alter table areas              enable row level security;
alter table sources            enable row level security;
alter table raw_items          enable row level security;
alter table announcements      enable row level security;
alter table push_subscriptions enable row level security;

drop policy if exists "public read areas" on areas;
create policy "public read areas" on areas for select using (true);

drop policy if exists "public read sources" on sources;
create policy "public read sources" on sources for select using (true);

drop policy if exists "public read announcements" on announcements;
create policy "public read announcements" on announcements for select using (true);
