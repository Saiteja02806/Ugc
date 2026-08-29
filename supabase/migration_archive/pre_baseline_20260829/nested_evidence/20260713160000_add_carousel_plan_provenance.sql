alter table public.carousel_generations
  add column if not exists content_plan_raw_response jsonb,
  add column if not exists content_plan_normalized jsonb,
  add column if not exists content_planner_version text,
  add column if not exists content_planner_model text,
  add column if not exists content_plan_source text,
  add column if not exists content_plan_fallback_reason text,
  add column if not exists content_plan_validation jsonb,
  add column if not exists renderer_version text;

comment on column public.carousel_generations.content_plan_raw_response is
  'Raw initial and optional repair responses returned by the carousel planner model.';
comment on column public.carousel_generations.content_plan_normalized is
  'Validated normalized carousel plan sent to image matching and rendering.';
comment on column public.carousel_generations.content_plan_validation is
  'Planner validation issues and repair outcome for the normalized plan.';
