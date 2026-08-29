alter function public.persist_trending_hook_copy_generation(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
)
rename to persist_trending_hook_copy_generation_slot_internal;

revoke all on function
  public.persist_trending_hook_copy_generation_slot_internal(
    uuid,
    text,
    uuid,
    integer,
    text,
    text,
    text,
    jsonb
  )
from public, anon, authenticated, service_role;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_trending_candidate_unique;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_trending_candidate_unique unique (
    business_profile_id,
    business_profile_version,
    suggestion_context,
    candidate_index
  );

create or replace function public.persist_trending_hook_copy_generation(
  p_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_prompt_version text,
  p_selection_version text,
  p_generator_model text,
  p_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
  persisted_count integer;
  slot_base integer;
  slotted_candidates jsonb;
begin
  select count(*)
  into existing_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if existing_count > 0 then
    return existing_count;
  end if;

  select coalesce(max(suggestion.candidate_index), -1) + 1
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  select jsonb_agg(
    jsonb_set(
      item.value,
      '{candidateIndex}',
      to_jsonb(
        slot_base + (item.value ->> 'candidateIndex')::integer
      ),
      false
    )
    order by item.ordinality
  )
  into slotted_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count :=
    public.persist_trending_hook_copy_generation_slot_internal(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      slotted_candidates
    );

  update public.user_hook_video_assignments as assignment
  set
    position = suggestion.candidate_index - slot_base,
    updated_at = now()
  from public.hook_video_suggestions as suggestion
  where assignment.hook_suggestion_id = suggestion.id
    and suggestion.generation_job_id = p_job_id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version;

  return persisted_count;
end;
$$;

revoke all on function public.persist_trending_hook_copy_generation(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_trending_hook_copy_generation(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
