-- Optional, purpose-limited email requests. No public read or write access.
create table public.resource_batch_notifications (
  batch text not null check (batch = 'hook-videos-2'),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  consent_version text not null check (consent_version = 'batch-2-only-v1'),
  created_at timestamptz not null default now(),
  primary key (batch, email)
);
alter table public.resource_batch_notifications enable row level security;
revoke all on public.resource_batch_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.resource_batch_notifications to service_role;
comment on table public.resource_batch_notifications is 'Opt-in for one Hook Video Batch 2 announcement only. No account required. Delete after the announcement or on cancellation; never use for unrelated marketing.';
