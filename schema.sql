create table if not exists baby_profile (
  id integer primary key default 1,
  name text not null default '',
  age text not null default '',
  weight text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint baby_profile_singleton check (id = 1)
);

create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists entries (
  id text primary key,
  type text not null check (type in ('bottle', 'food', 'diaper', 'sleep', 'care')),
  entry_date date not null,
  entry_time time not null,
  amount integer,
  food_name text,
  diaper_type text,
  sleep_start time,
  sleep_end time,
  sleep_minutes integer not null default 0,
  vitamin boolean not null default false,
  bath boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_date_time_idx on entries (entry_date, entry_time);
create index if not exists entries_type_date_idx on entries (type, entry_date);

create table if not exists appointments (
  id text primary key,
  appointment_date date not null,
  appointment_time time not null,
  specialty text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_date_time_idx on appointments (appointment_date, appointment_time);

create table if not exists notification_settings (
  id integer primary key default 1,
  bottle_enabled boolean not null default false,
  bottle_minutes integer not null default 180,
  diaper_enabled boolean not null default false,
  diaper_minutes integer not null default 120,
  sent_keys jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notification_settings_singleton check (id = 1)
);

create table if not exists audit_log (
  id bigserial primary key,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
