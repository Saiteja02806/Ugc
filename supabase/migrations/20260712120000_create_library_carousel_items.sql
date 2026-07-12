create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text not null,

  source_type text not null
    check (source_type in ('generated_carousel')),
  source_id text not null,

  media_type text not null default 'carousel'
    check (media_type in ('carousel')),
  title text not null,
  cover_url text,
  thumbnail_url text,
  status text not null default 'ready'
    check (status in ('ready', 'archived')),

  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists library_items_user_source_uidx
  on public.library_items (user_id, source_type, source_id)
  where deleted_at is null;

create index if not exists library_items_user_project_updated_idx
  on public.library_items (user_id, project_id, updated_at desc)
  where deleted_at is null;

create table if not exists public.library_carousel_slides (
  id uuid primary key default gen_random_uuid(),

  library_item_id uuid not null
    references public.library_items(id) on delete cascade,
  carousel_generation_id uuid not null
    references public.carousel_generations(id) on delete restrict,
  carousel_slide_id uuid references public.carousel_slides(id) on delete set null,

  slide_number int not null check (slide_number > 0),
  slide_type text,
  headline text,
  subtext text,
  rendered_url text not null,
  rendered_s3_key text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (library_item_id, slide_number)
);

create index if not exists library_carousel_slides_item_slide_idx
  on public.library_carousel_slides (library_item_id, slide_number);

alter table public.library_items enable row level security;
alter table public.library_carousel_slides enable row level security;

revoke all privileges on table public.library_items
  from anon, authenticated;

revoke all privileges on table public.library_carousel_slides
  from anon, authenticated;

grant select, insert, update, delete on table public.library_items
  to service_role;

grant select, insert, update, delete on table public.library_carousel_slides
  to service_role;

create or replace function public.save_generated_carousel_library_item(
  p_user_id text,
  p_project_id text,
  p_source_id text,
  p_title text,
  p_cover_url text,
  p_thumbnail_url text,
  p_metadata jsonb,
  p_slides jsonb
)
returns table(item_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_slide jsonb;
begin
  select id
    into v_item_id
  from public.library_items
  where user_id = p_user_id
    and source_type = 'generated_carousel'
    and source_id = p_source_id
    and deleted_at is null
  limit 1;

  if v_item_id is not null then
    return query select v_item_id, false;
    return;
  end if;

  insert into public.library_items (
    user_id,
    project_id,
    source_type,
    source_id,
    media_type,
    title,
    cover_url,
    thumbnail_url,
    metadata
  )
  values (
    p_user_id,
    p_project_id,
    'generated_carousel',
    p_source_id,
    'carousel',
    p_title,
    p_cover_url,
    p_thumbnail_url,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_item_id;

  for v_slide in
    select value from jsonb_array_elements(coalesce(p_slides, '[]'::jsonb))
  loop
    insert into public.library_carousel_slides (
      library_item_id,
      carousel_generation_id,
      carousel_slide_id,
      slide_number,
      slide_type,
      headline,
      subtext,
      rendered_url,
      rendered_s3_key,
      metadata
    )
    values (
      v_item_id,
      (v_slide->>'carouselGenerationId')::uuid,
      nullif(v_slide->>'carouselSlideId', '')::uuid,
      (v_slide->>'slideNumber')::int,
      nullif(v_slide->>'slideType', ''),
      nullif(v_slide->>'headline', ''),
      nullif(v_slide->>'subtext', ''),
      v_slide->>'renderedUrl',
      nullif(v_slide->>'renderedS3Key', ''),
      coalesce(v_slide->'metadata', '{}'::jsonb)
    );
  end loop;

  return query select v_item_id, true;
end;
$$;

revoke all on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public;

grant execute on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
