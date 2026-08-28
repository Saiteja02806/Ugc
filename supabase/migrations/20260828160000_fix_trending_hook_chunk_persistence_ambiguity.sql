-- The RETURNS TABLE field `completed_valid_count` becomes a PL/pgSQL variable.
-- In the persistence update, unqualified references were therefore ambiguous
-- between that output field and the generation-run table column. Qualifying
-- the table row lets a worker save accepted Hook results and finish the run.
create or replace function public.persist_trending_hook_generation_chunk_v1(
  p_run_id uuid,
  p_chunk_id uuid,
  p_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_prompt_version text,
  p_selection_version text,
  p_generator_model text,
  p_candidates jsonb
)
returns table (
  accepted_count integer,
  already_persisted boolean,
  completed_valid_count integer,
  remaining_valid_count integer,
  run_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
  v_accepted_count integer;
  v_candidate_count integer;
  v_accepted_video_ids text[];
  v_remaining_before integer;
begin
  if p_run_id is null
    or p_chunk_id is null
    or p_job_id is null
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
    and chunk.run_id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_chunk_not_found';
  end if;

  if v_chunk.status = 'completed' then
    return query
    select
      v_chunk.accepted_count,
      true,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
      v_run.status;
    return;
  end if;

  if v_run.status not in ('queued', 'processing', 'continuation_pending')
    or v_chunk.background_job_id <> p_job_id
  then
    raise exception 'trending_hook_generation_run_scope_mismatch';
  end if;

  v_candidate_count := jsonb_array_length(p_candidates);
  v_remaining_before := v_run.target_valid_count - v_run.completed_valid_count;

  if v_candidate_count > v_remaining_before
    or v_candidate_count > v_chunk.candidate_count
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidates) as candidate(value)
    ) <> v_candidate_count
    or exists (
      select 1
      from jsonb_array_elements(p_candidates) as candidate(value)
      where not exists (
        select 1
        from public.trending_hook_generation_run_candidates as source_candidate
        where source_candidate.run_id = p_run_id
          and source_candidate.chunk_id = p_chunk_id
          and source_candidate.influencer_video_id = trim(candidate.value ->> 'influencerVideoId')
      )
    )
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_candidates';
  end if;

  if v_candidate_count = 0 then
    v_accepted_count := 0;
  else
    v_accepted_count := public.persist_trending_hook_copy_generation_v7(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      p_candidates
    );
  end if;

  if v_accepted_count <> v_candidate_count then
    raise exception 'trending_hook_generation_run_persistence_mismatch';
  end if;

  select array_agg(trim(candidate.value ->> 'influencerVideoId'))
  into v_accepted_video_ids
  from jsonb_array_elements(p_candidates) as candidate(value);

  update public.trending_hook_generation_run_candidates as candidate
  set
    state = case
      when candidate.influencer_video_id = any(v_accepted_video_ids) then 'accepted'
      else 'rejected'
    end,
    attempted_at = now(),
    updated_at = now()
  where candidate.run_id = p_run_id
    and candidate.chunk_id = p_chunk_id
    and candidate.state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    accepted_count = v_accepted_count,
    rejected_count = candidate_count - v_accepted_count,
    status = 'completed',
    completed_at = now(),
    last_error = null,
    updated_at = now()
  where id = p_chunk_id;

  update public.trending_hook_generation_runs as run
  set
    completed_valid_count = run.completed_valid_count + v_accepted_count,
    status = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then 'completed'
      else 'continuation_pending'
    end,
    completed_at = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then now()
      else null
    end,
    last_error = null,
    updated_at = now()
  where run.id = p_run_id
  returning run.* into v_run;

  return query
  select
    v_accepted_count,
    false,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
    v_run.status;
end;
$$;

revoke all on function public.persist_trending_hook_generation_chunk_v1(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_trending_hook_generation_chunk_v1(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
