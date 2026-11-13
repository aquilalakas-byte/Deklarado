-- Deklarado — school calendar events and night-before reminders (run after 0003)

-- A private copy of each phone's own school-calendar events, so reminders can be sent.
-- Linked ONLY to that phone's notification subscription: no name, no account. Deleted with the subscription.
create table if not exists personal_events (
  id         bigint generated always as identity primary key,
  endpoint   text not null references push_subscriptions(endpoint) on delete cascade,
  start_date date not null,
  end_date   date not null,
  title      text not null check (char_length(title) <= 80),
  kind       text not null check (kind in ('no_class', 'exam', 'event')),
  created_at timestamptz not null default now()
);
create index if not exists personal_events_start_idx on personal_events(start_date);
create index if not exists personal_events_endpoint_idx on personal_events(endpoint);
alter table personal_events enable row level security; -- server only

-- Remembers which reminders were already sent, so nobody gets the same one twice.
create table if not exists reminder_log (
  key     text primary key,           -- e.g. 'holiday:2026-12-25' or 'event:<hash>'
  sent_at timestamptz not null default now()
);
alter table reminder_log enable row level security; -- server only

-- Which reminders each phone wants (Settings → Notifications)
alter table push_subscriptions add column if not exists remind_holidays boolean not null default true;
alter table push_subscriptions add column if not exists remind_events boolean not null default true;
