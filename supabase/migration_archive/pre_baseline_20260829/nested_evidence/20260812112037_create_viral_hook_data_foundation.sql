create table if not exists public.viral_references (
  id uuid primary key default gen_random_uuid(),
  section text not null
    check (section in ('hook_video', 'wall_of_text', 'slideshow')),
  platform text not null default 'instagram'
    check (platform = 'instagram'),
  source_url text not null unique
    check (
      source_url = trim(source_url)
      and source_url ~ '^https://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/?$'
    ),
  embed_html text not null
    check (char_length(trim(embed_html)) > 0),
  embed_status text not null default 'active'
    check (
      embed_status in ('active', 'suspected_unavailable', 'unavailable')
    ),
  publish_status text not null default 'pending_review'
    check (publish_status in ('pending_review', 'published', 'hidden')),
  editor_rank integer
    check (editor_rank is null or editor_rank > 0),
  last_verified_at timestamptz,
  next_check_at timestamptz,
  verification_failures integer not null default 0
    check (verification_failures >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.viral_references is
  'Server-managed Instagram references. Original media remains hosted by Instagram.';

create index if not exists viral_references_published_feed_idx
  on public.viral_references (
    section,
    editor_rank asc nulls last,
    created_at desc
  )
  where publish_status = 'published' and embed_status = 'active';

create index if not exists viral_references_hook_review_idx
  on public.viral_references (created_at asc)
  where section = 'hook_video' and publish_status = 'pending_review';

create index if not exists viral_references_verification_due_idx
  on public.viral_references (next_check_at asc)
  where next_check_at is not null and embed_status <> 'unavailable';

create table if not exists public.viral_hook_config (
  reference_id uuid primary key
    references public.viral_references(id) on delete cascade,
  hook_start_ms integer generated always as (0) stored,
  hook_end_ms integer not null
    check (hook_end_ms > 0),
  reviewed_at timestamptz not null default now(),
  reviewed_by text not null
    check (char_length(trim(reviewed_by)) between 1 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.viral_hook_config is
  'Private hook timing intelligence. Never include this table in customer feed responses.';
comment on column public.viral_hook_config.hook_start_ms is
  'All Viral hooks begin at zero milliseconds.';
comment on column public.viral_hook_config.hook_end_ms is
  'Admin-reviewed hook ending boundary in milliseconds.';

create or replace function public.validate_viral_hook_reference_section()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.viral_references as reference
    where reference.id = new.reference_id
      and reference.section = 'hook_video'
  ) then
    raise exception 'viral_hook_reference_must_be_hook_video';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_viral_hook_reference_section
  on public.viral_hook_config;
create trigger validate_viral_hook_reference_section
  before insert or update of reference_id
  on public.viral_hook_config
  for each row
  execute function public.validate_viral_hook_reference_section();

alter table public.viral_references enable row level security;
alter table public.viral_hook_config enable row level security;

revoke all privileges on table public.viral_references
  from public, anon, authenticated, service_role;
revoke all privileges on table public.viral_hook_config
  from public, anon, authenticated, service_role;
revoke all on function public.validate_viral_hook_reference_section()
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.viral_references
  to service_role;
grant select, insert, update, delete on table public.viral_hook_config
  to service_role;
grant execute on function public.validate_viral_hook_reference_section()
  to service_role;

select pg_notify('pgrst', 'reload schema');
