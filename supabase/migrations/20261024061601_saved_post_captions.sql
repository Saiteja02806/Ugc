-- Account-owned reusable captions; separate from immutable scheduling receipts.
create table public.user_saved_captions (
  user_id text primary key check (length(user_id) between 1 and 128),
  captions jsonb not null default '[]'::jsonb,
  default_caption_id uuid,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(captions) = 'array' and jsonb_array_length(captions) <= 20 and octet_length(captions::text) <= 450000),
  check (default_caption_id is null or captions @> jsonb_build_array(jsonb_build_object('id', default_caption_id::text)))
);
alter table public.user_saved_captions enable row level security;
revoke all on public.user_saved_captions from public, anon, authenticated;
grant select, insert, update on public.user_saved_captions to service_role;
