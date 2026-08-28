-- A RETURNS TABLE field named `run_id` becomes a PL/pgSQL variable. The
-- original reservation function left two table references unqualified, so
-- PostgreSQL rejected every first or continuation chunk with
-- "column reference run_id is ambiguous" before a worker job could exist.
--
-- This is deliberately a forward-only replacement: the original migration is
-- already deployed, while this version restores the durable chunk hand-off.
create or replace function public.reserve_trending_hook_generation_chunk_v1(
  p_run_id uuid,
  p_chunk_size integer default 6
)
returns table (
  run_id uuid,
  run_status text,
  chunk_id uuid,
  chunk_number integer,
  candidate_payloads jsonb,
  target_valid_count integer,
  completed_valid_count integer,
  remaining_valid_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
  v_candidate_ids uuid[];
  v_candidate_payloads jsonb;
  v_chunk_number integer;
begin
  if p_run_id is null or coalesce(p_chunk_size, 0) not between 1 and 12 then
    raise exception 'trending_hook_generation_chunk_invalid_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_run_not_found';
  end if;

  if v_run.status in ('completed', 'source_exhausted', 'superseded', 'failed') then
    return query
    select
      v_run.id,
      v_run.status,
      null::uuid,
      null::integer,
      '[]'::jsonb,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.run_id = v_run.id
    and chunk.status = 'reserved'
  order by chunk.chunk_number desc
  limit 1
  for update;

  if found then
    select coalesce(jsonb_agg(candidate.candidate_payload order by candidate.candidate_order), '[]'::jsonb)
    into v_candidate_payloads
    from public.trending_hook_generation_run_candidates as candidate
    where candidate.run_id = v_run.id
      and candidate.chunk_id = v_chunk.id;

    return query
    select
      v_run.id,
      v_run.status,
      v_chunk.id,
      v_chunk.chunk_number,
      v_candidate_payloads,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select
    array_agg(candidate.id order by candidate.candidate_order),
    jsonb_agg(candidate.candidate_payload order by candidate.candidate_order)
  into v_candidate_ids, v_candidate_payloads
  from (
    select *
    from public.trending_hook_generation_run_candidates as candidate
    where candidate.run_id = v_run.id
      and candidate.state = 'pending'
    order by candidate_order
    limit p_chunk_size
    for update skip locked
  ) as candidate;

  if coalesce(array_length(v_candidate_ids, 1), 0) = 0 then
    update public.trending_hook_generation_runs
    set
      status = 'source_exhausted',
      last_error = 'No unused eligible Hook-video candidates remain for this generation run.',
      updated_at = now()
    where id = v_run.id
    returning * into v_run;

    return query
    select
      v_run.id,
      v_run.status,
      null::uuid,
      null::integer,
      '[]'::jsonb,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select coalesce(max(chunk.chunk_number), 0) + 1
  into v_chunk_number
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.run_id = v_run.id;

  insert into public.trending_hook_generation_run_chunks (
    run_id,
    chunk_number,
    candidate_count,
    status
  ) values (
    v_run.id,
    v_chunk_number,
    array_length(v_candidate_ids, 1),
    'reserved'
  )
  returning * into v_chunk;

  update public.trending_hook_generation_run_candidates
  set
    state = 'reserved',
    chunk_id = v_chunk.id,
    updated_at = now()
  where id = any(v_candidate_ids);

  update public.trending_hook_generation_runs
  set
    status = 'queued',
    last_error = null,
    updated_at = now()
  where id = v_run.id
  returning * into v_run;

  return query
  select
    v_run.id,
    v_run.status,
    v_chunk.id,
    v_chunk.chunk_number,
    v_candidate_payloads,
    v_run.target_valid_count,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
end;
$$;

revoke all on function public.reserve_trending_hook_generation_chunk_v1(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_trending_hook_generation_chunk_v1(uuid, integer)
  to service_role;
