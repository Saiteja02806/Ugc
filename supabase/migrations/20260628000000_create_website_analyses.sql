create table if not exists public.website_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id text not null,
  website_url text not null,
  normalized_domain text not null,

  business_name text,
  category text,
  product_summary text,

  target_audience text[] not null default '{}',
  main_problem text,
  main_promise text,
  value_props text[] not null default '{}',
  pain_points text[] not null default '{}',
  differentiators text[] not null default '{}',

  brand_tone text,

  carousel_angles text[] not null default '{}',
  pexels_image_queries text[] not null default '{}',
  visual_keywords text[] not null default '{}',
  recommended_carousel_structure text[] not null default '{}',
  cta_ideas text[] not null default '{}',

  claims_to_avoid text[] not null default '{}',
  missing_info text[] not null default '{}',

  confidence text not null check (confidence in ('low', 'medium', 'high')),
  confidence_reason text,
  analysis_json jsonb not null check (jsonb_typeof(analysis_json) = 'object'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_analyses enable row level security;

grant select, insert on table public.website_analyses to service_role;

create index if not exists website_analyses_project_created_idx
  on public.website_analyses (project_id, created_at desc);

create index if not exists website_analyses_domain_idx
  on public.website_analyses (normalized_domain);
