-- Deklarado — mistake reports and notification language (run after 0002_wind_signals.sql)

-- "Report a mistake" from the app. No personal data — only which announcement, why, and an optional note.
create table if not exists reports (
  id              bigint generated always as identity primary key,
  announcement_id bigint not null references announcements(id) on delete cascade,
  reason          text not null check (reason in ('wrong_place', 'wrong_date', 'wrong_levels', 'not_suspension', 'other')),
  note            text check (char_length(note) <= 300),
  status          text not null default 'new' check (status in ('new', 'confirmed', 'dismissed')), -- for the team's review
  created_at      timestamptz not null default now()
);

create index if not exists reports_announcement_idx on reports(announcement_id);

-- Only the server (service role) can read or write reports; the team reviews them in the Supabase dashboard.
alter table reports enable row level security;

-- Language for push notifications ('en' or 'fil')
alter table push_subscriptions add column if not exists lang text not null default 'en' check (lang in ('en', 'fil'));
