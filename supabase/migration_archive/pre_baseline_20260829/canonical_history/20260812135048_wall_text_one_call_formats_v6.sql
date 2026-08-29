alter table public.wall_text_creatives
  alter column generator_version
    set default 'business-profile-wall-text-v6';

alter table public.wall_text_creatives
  drop constraint if exists wall_text_creatives_text_content_chk;

alter table public.wall_text_creatives
  add constraint wall_text_creatives_text_content_chk
  check (
    coalesce(
      jsonb_typeof(text_content) = 'object'
      and text_content ->> 'kind' = 'wall_text'
      and (
        text_content ->> 'layoutVersion' in (
          'wall-text-overlay-v1',
          'wall-text-overlay-v2',
          'wall-text-overlay-v3',
          'wall-text-overlay-v4'
        )
        or (
          text_content ->> 'layoutVersion' = 'wall-text-overlay-v5'
          and text_content ->> 'formatId' in (
            'identity_mirror',
            'recognizable_moment',
            'hidden_truth',
            'contrarian_reframe',
            'personal_confession',
            'aspiration_redefinition',
            'pain_beneath_the_pain',
            'niche_insight',
            'list_rules',
            'community_prompt',
            'analogy_reframe',
            'progression_sequence'
          )
          and jsonb_typeof(text_content -> 'fullText') = 'string'
          and char_length(trim(text_content ->> 'fullText')) between 1 and 600
          and jsonb_typeof(text_content -> 'sourceContent') = 'object'
          and text_content -> 'sourceContent' ->> 'kind' in ('prose', 'list')
          and jsonb_typeof(text_content -> 'finalLayout') = 'object'
          and text_content -> 'finalLayout' ->> 'version' = 'wall-text-final-layout-v1'
          and text_content -> 'finalLayout' ->> 'fontFamily' = 'Inter'
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer = 700
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer
            in (44, 46, 48, 50, 52)
          and jsonb_typeof(text_content -> 'finalLayout' -> 'textBox') = 'object'
          and jsonb_typeof(text_content -> 'finalLayout' -> 'blocks') = 'array'
          and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks')
            between 1 and 6
        )
      ),
      false
    )
  );

create or replace function public.replace_wall_text_creative_copy_v6(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_generator_model text,
  p_updates jsonb
)
returns setof public.wall_text_creatives
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v6',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$$;

revoke all on function public.replace_wall_text_creative_copy_v6(
  text,
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.replace_wall_text_creative_copy_v6(
  text,
  uuid,
  integer,
  text,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
