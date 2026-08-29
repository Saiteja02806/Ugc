alter table public.carousel_generations
  add column if not exists content_format_id text,
  add column if not exists hook_family_id text,
  add column if not exists content_grammar_version text,
  add column if not exists content_selector_version text,
  add column if not exists content_history_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists content_audience_id text,
  add column if not exists content_problem_id text,
  add column if not exists content_goal_id text,
  add column if not exists content_topic_id text,
  add column if not exists content_topic text,
  add column if not exists content_angle text;

alter table public.carousel_generations
  drop constraint if exists carousel_generations_content_selection_pair_check,
  add constraint carousel_generations_content_selection_pair_check check (
    (
      content_format_id is null
      and hook_family_id is null
      and content_grammar_version is null
      and content_selector_version is null
    )
    or
    (
      content_format_id is not null
      and hook_family_id is not null
      and content_grammar_version is not null
      and content_selector_version is not null
    )
  ),
  drop constraint if exists carousel_generations_content_history_snapshot_check,
  add constraint carousel_generations_content_history_snapshot_check check (
    jsonb_typeof(content_history_snapshot) = 'array'
    and jsonb_array_length(content_history_snapshot) <= 10
  ),
  drop constraint if exists carousel_generations_content_format_id_check,
  add constraint carousel_generations_content_format_id_check check (
    content_format_id is null
    or content_format_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
  ),
  drop constraint if exists carousel_generations_hook_family_id_check,
  add constraint carousel_generations_hook_family_id_check check (
    hook_family_id is null
    or hook_family_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
  ),
  drop constraint if exists carousel_generations_content_option_ids_check,
  add constraint carousel_generations_content_option_ids_check check (
    (content_audience_id is null or char_length(content_audience_id) between 1 and 100)
    and (content_problem_id is null or char_length(content_problem_id) between 1 and 100)
    and (content_goal_id is null or char_length(content_goal_id) between 1 and 100)
    and (content_topic_id is null or char_length(content_topic_id) between 1 and 100)
  ),
  drop constraint if exists carousel_generations_content_labels_check,
  add constraint carousel_generations_content_labels_check check (
    (content_topic is null or char_length(trim(content_topic)) between 1 and 240)
    and (content_angle is null or char_length(trim(content_angle)) between 1 and 360)
  );

create index if not exists carousel_generations_profile_content_history_idx
  on public.carousel_generations (
    business_profile_id,
    created_at desc,
    candidate_index desc
  )
  where business_profile_id is not null
    and generation_source = 'auto_generated'
    and status in ('processing', 'completed');

comment on column public.carousel_generations.content_format_id is
  'Backend-reserved five-slide content structure. This is separate from format, which stores the canvas ratio.';
comment on column public.carousel_generations.hook_family_id is
  'Backend-reserved hook strategy compatible with content_format_id.';
comment on column public.carousel_generations.content_history_snapshot is
  'Compact retry-stable history input used for repetition avoidance; never a copy of prior full slides.';
comment on column public.carousel_generations.content_grammar_version is
  'Version of the format and hook-family configuration used for this generation.';
comment on column public.carousel_generations.content_selector_version is
  'Version of the deterministic backend selector that reserved the content structure.';

select pg_notify('pgrst', 'reload schema');
