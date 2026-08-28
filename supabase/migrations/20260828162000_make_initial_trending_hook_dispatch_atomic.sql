-- A Hook run, its first reserved candidate chunk, and the dispatch-outbox
-- record must be committed as one unit. The prior application flow used two
-- separate PostgREST RPCs: first create/resume the run, then reserve a chunk.
-- If the process stopped in between, a queued run could exist with no chunk,
-- no outbox record, and therefore no recoverable work.
--
-- PostgreSQL functions execute inside the RPC request transaction. Calling the
-- existing two functions from this wrapper gives the application one atomic
-- operation without duplicating the established locking/reservation logic.
-- The reservation trigger from 20260828150000 inserts the outbox row in this
-- same transaction whenever a new reserved chunk is inserted.
create or replace function public.create_or_resume_and_reserve_trending_hook_generation_chunk_v1(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_prompt_version text,
  p_selection_version text,
  p_source_selection_key text,
  p_target_valid_count integer,
  p_candidate_pool jsonb,
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
  v_run record;
begin
  select *
  into v_run
  from public.create_or_resume_trending_hook_generation_run_v1(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_source_selection_key,
    p_target_valid_count,
    p_candidate_pool
  );

  return query
  select
    reserved.run_id,
    reserved.run_status,
    reserved.chunk_id,
    reserved.chunk_number,
    reserved.candidate_payloads,
    reserved.target_valid_count,
    reserved.completed_valid_count,
    reserved.remaining_valid_count
  from public.reserve_trending_hook_generation_chunk_v1(
    v_run.run_id,
    p_chunk_size
  ) as reserved;
end;
$$;

-- Repair only historical states created by the old two-RPC implementation.
-- Reserving the first chunk invokes the outbox trigger, so the normal dispatch
-- recovery can then safely create and attach the physical background job.
create or replace function public.reserve_missing_initial_trending_hook_generation_chunks_v1(
  p_limit integer default 25
)
returns table (
  run_id uuid,
  chunk_id uuid,
  user_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_run record;
  v_reserved record;
begin
  for v_run in
    select
      run.id,
      run.user_id
    from public.trending_hook_generation_runs as run
    where run.status = 'queued'
      and not exists (
        select 1
        from public.trending_hook_generation_run_chunks as chunk
        where chunk.run_id = run.id
      )
    order by run.created_at, run.id
    limit v_limit
    for update of run skip locked
  loop
    select *
    into v_reserved
    from public.reserve_trending_hook_generation_chunk_v1(v_run.id, 6);

    if v_reserved.chunk_id is not null then
      return query
      select
        v_reserved.run_id,
        v_reserved.chunk_id,
        v_run.user_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.create_or_resume_and_reserve_trending_hook_generation_chunk_v1(
  text, uuid, integer, text, text, text, integer, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.reserve_missing_initial_trending_hook_generation_chunks_v1(integer)
  from public, anon, authenticated;

grant execute on function public.create_or_resume_and_reserve_trending_hook_generation_chunk_v1(
  text, uuid, integer, text, text, text, integer, jsonb, integer
) to service_role;
grant execute on function public.reserve_missing_initial_trending_hook_generation_chunks_v1(integer)
  to service_role;

select pg_notify('pgrst', 'reload schema');
