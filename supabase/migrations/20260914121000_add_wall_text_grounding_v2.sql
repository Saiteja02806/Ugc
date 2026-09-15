-- Wall V2 stores one immutable, backend-selected fact on every new
-- reservation. The V1 focus object remains valid so active pre-release work
-- can finish through its existing Reviewer path.

create or replace function public.validate_wall_text_generation_assignment_grounding_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record public.business_profiles;
  canonical_snapshot jsonb;
  canonical_fact jsonb;
begin
  if new.focus_json is null or new.focus_json->>'contextVersion' is null then
    return new;
  end if;

  if new.focus_json->>'contextVersion' <> 'wall-text-grounding-v2' then
    raise exception 'wall_text_grounding_context_version_invalid';
  end if;

  select profile.* into profile_record
  from public.wall_text_generation_batches as batch
  join public.business_profiles as profile
    on profile.id = batch.business_profile_id
   and profile.user_id = batch.user_id
   and profile.profile_version = batch.business_profile_version
  where batch.id = new.batch_id;
  if not found then
    raise exception 'wall_text_grounding_profile_mismatch';
  end if;

  canonical_snapshot := public.reaction_business_fact_snapshot_v1(
    profile_record.context_json
  );
  if new.focus_json->'factSnapshot' is distinct from canonical_snapshot then
    raise exception 'wall_text_grounding_snapshot_mismatch';
  end if;

  if jsonb_typeof(new.focus_json->'assignedFact') <> 'object'
    or nullif(btrim(new.focus_json->'assignedFact'->>'id'), '') is null then
    raise exception 'wall_text_grounding_assignment_invalid';
  end if;

  select fact.value into canonical_fact
  from jsonb_array_elements(canonical_snapshot->'facts') as fact(value)
  where fact.value->>'id' = new.focus_json->'assignedFact'->>'id';

  if canonical_fact is null
    or new.focus_json->'assignedFact' is distinct from canonical_fact then
    raise exception 'wall_text_grounding_assignment_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_wall_text_generation_assignment_grounding_v2
  on public.wall_text_generation_assignments;
create trigger validate_wall_text_generation_assignment_grounding_v2
before insert or update of batch_id, focus_json
on public.wall_text_generation_assignments
for each row
execute function public.validate_wall_text_generation_assignment_grounding_v2();

-- The final creative carries a compact audit record. Its complete snapshot
-- stays on the assignment; the trigger prevents a caller from swapping the
-- displayed anchor while saving a generated card. This is insert-only so a
-- user's later manual edit retains the established editing behavior.
create or replace function public.validate_wall_text_creative_grounding_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_focus jsonb;
  expected_grounding jsonb;
begin
  select assignment.focus_json into assignment_focus
  from public.wall_text_generation_assignments as assignment
  where assignment.batch_id = new.generation_id
    and assignment.creative_candidate_index = new.candidate_index;

  if not found or assignment_focus->>'contextVersion' is null then
    return new;
  end if;

  if assignment_focus->>'contextVersion' <> 'wall-text-grounding-v2' then
    raise exception 'wall_text_creative_grounding_context_invalid';
  end if;

  expected_grounding := jsonb_build_object(
    'anchorId', assignment_focus->'assignedFact'->>'id',
    'factSnapshotVersion', assignment_focus->'factSnapshot'->>'version',
    'factText', assignment_focus->'assignedFact'->>'text',
    'factType', assignment_focus->'assignedFact'->>'type',
    'version', 'wall-text-grounding-v2'
  );

  if new.text_content->'grounding' is distinct from expected_grounding then
    raise exception 'wall_text_creative_grounding_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_wall_text_creative_grounding_v2
  on public.wall_text_creatives;
create trigger validate_wall_text_creative_grounding_v2
before insert
on public.wall_text_creatives
for each row
execute function public.validate_wall_text_creative_grounding_v2();

revoke all on function public.validate_wall_text_generation_assignment_grounding_v2()
  from public, anon, authenticated;
revoke all on function public.validate_wall_text_creative_grounding_v2()
  from public, anon, authenticated;
grant execute on function public.validate_wall_text_generation_assignment_grounding_v2()
  to service_role;
grant execute on function public.validate_wall_text_creative_grounding_v2()
  to service_role;

select pg_notify('pgrst', 'reload schema');
