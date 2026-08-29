create table if not exists public.category_image_assets (
  id uuid primary key default gen_random_uuid(),

  category_slug text not null,
  image_query text,
  visual_keywords jsonb not null default '[]'::jsonb
    check (jsonb_typeof(visual_keywords) = 'array'),

  source_provider text not null default 'pexels'
    check (source_provider in ('pexels')),
  pexels_photo_id text,
  pexels_photo_url text,
  pexels_photographer text,
  pexels_photographer_url text,

  base_s3_key text not null,
  thumb_s3_key text,
  base_url text not null,
  thumb_url text,

  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  avg_color text,
  orientation text not null default 'portrait'
    check (orientation in ('portrait', 'square', 'landscape')),

  quality_score numeric check (
    quality_score is null or (quality_score >= 0 and quality_score <= 1)
  ),
  usage_count int not null default 0 check (usage_count >= 0),

  status text not null default 'ready'
    check (status in ('ready', 'processing', 'failed', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists category_image_assets_provider_photo_uidx
  on public.category_image_assets (source_provider, pexels_photo_id)
  where pexels_photo_id is not null;

create unique index if not exists category_image_assets_base_key_uidx
  on public.category_image_assets (base_s3_key);

create index if not exists category_image_assets_ready_category_idx
  on public.category_image_assets (category_slug, status, usage_count, created_at);

alter table public.category_image_assets enable row level security;

grant select, insert, update on table public.category_image_assets to service_role;

create table if not exists public.carousel_generations (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text not null,
  website_analysis_id uuid references public.website_analyses(id) on delete set null,

  category_slug text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),

  slide_count int not null default 6 check (slide_count between 1 and 10),
  format text not null default '4:5' check (format in ('4:5', '1:1')),
  goal text,
  selected_angle text,

  error_message text,
  trigger_run_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carousel_generations_project_created_idx
  on public.carousel_generations (project_id, created_at desc);

create index if not exists carousel_generations_analysis_idx
  on public.carousel_generations (website_analysis_id);

alter table public.carousel_generations enable row level security;

grant select, insert, update on table public.carousel_generations to service_role;

create table if not exists public.carousel_slides (
  id uuid primary key default gen_random_uuid(),

  carousel_generation_id uuid not null
    references public.carousel_generations(id) on delete cascade,

  slide_number int not null check (slide_number > 0),
  slide_type text,

  headline text not null,
  subtext text,
  cta_text text,

  image_direction text,
  layout_preset text,
  text_position text,

  category_image_asset_id uuid references public.category_image_assets(id),

  rendered_s3_key text,
  rendered_url text,

  status text not null default 'ready'
    check (status in ('ready', 'processing', 'failed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (carousel_generation_id, slide_number)
);

create index if not exists carousel_slides_generation_slide_idx
  on public.carousel_slides (carousel_generation_id, slide_number);

create index if not exists carousel_slides_asset_idx
  on public.carousel_slides (category_image_asset_id);

alter table public.carousel_slides enable row level security;

grant select, insert, update on table public.carousel_slides to service_role;
