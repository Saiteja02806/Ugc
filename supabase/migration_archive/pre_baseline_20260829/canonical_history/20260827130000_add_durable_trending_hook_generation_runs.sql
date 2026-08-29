-- A Hook generation run owns the complete number of valid Hooks promised to a
-- Trending feed. Individual background jobs only process one small chunk of
-- source videos. This prevents a partial worker result from being treated as
-- the end of the user's requested generation.
create table if not exists public.trending_hook_generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(trim(user_id)) between 1 and 128),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null check (business_profile_version > 0),
  prompt_version text not null check (char_length(trim(prompt_version)) between 1 and 120),
  selection_version text not null check (char_length(trim(selection_version)) between 1 and 120),
  source_selection_key text not null default '',
  target_valid_count integer not null check (target_valid_count between 1 and 100),
  completed_valid_count integer not null default 0
    check (completed_valid_count between 0 and target_valid_count),
  status text not null default 'queued'
    check (status in (
      'queued',
      'processing',
      'continuation_pending',
      'completed',
      'source_exhausted',
      'superseded',
      'failed'
    )),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trending_hook_generation_runs_one_active_scope_idx
  on public.trending_hook_generation_runs (
    user_id,
    business_profile_id,
    business_profile_version
  )
  where status in ('queued', 'processing', 'continuation_pending');

create index if not exists trending_hook_generation_runs_lookup_idx
  on public.trending_hook_generation_runs (
    user_id,
    business_profile_id,
    business_profile_version,
    updated_at desc
  );

create table if not exists public.trending_hook_generation_run_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.trending_hook_generation_runs(id) on delete cascade,
  influencer_video_id text not null check (char_length(trim(influencer_video_id)) between 1 and 240),
  candidate_order integer not null check (candidate_order >= 0),
  candidate_payload jsonb not null check (jsonb_typeof(candidate_payload) = 'object'),
  state text not null default 'pending'
    check (state in ('pending', 'reserved', 'accepted', 'rejected')),
  chunk_id uuid,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, influencer_video_id)
);

create index if not exists trending_hook_generation_run_candidates_pending_idx
  on public.trending_hook_generation_run_candidates (run_id, state, candidate_order)
  where state = 'pending';

create table if not exists public.trending_hook_generation_run_chunks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.trending_hook_generation_runs(id) on delete cascade,
  chunk_number integer not null check (chunk_number >= 1),
  background_job_id uuid references public.background_jobs(id) on delete set null,
  candidate_count integer not null check (candidate_count between 1 and 12),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'failed')),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, chunk_number),
  unique (background_job_id)
);

alter table public.trending_hook_generation_run_candidates
  drop constraint if exists trending_hook_generation_run_candidates_chunk_id_fkey;
alter table public.trending_hook_generation_run_candidates
  add constraint trending_hook_generation_run_candidates_chunk_id_fkey
  foreign key (chunk_id)
  references public.trending_hook_generation_run_chunks(id)
  on delete set null;

create index if not exists trending_hook_generation_run_chunks_active_idx
  on public.trending_hook_generation_run_chunks (run_id, created_at desc)
  where status = 'reserved';

alter table public.trending_hook_generation_runs enable row level security;
alter table public.trending_hook_generation_run_candidates enable row level security;
alter table public.trending_hook_generation_run_chunks enable row level security;

revoke all privileges on table public.trending_hook_generation_runs
  from public, anon, authenticated;
revoke all privileges on table public.trending_hook_generation_run_candidates
  from public, anon, authenticated;
revoke all privileges on table public.trending_hook_generation_run_chunks
  from public, anon, authenticated;

grant select, insert, update on table public.trending_hook_generation_runs
  to service_role;
grant select, insert, update on table public.trending_hook_generation_run_candidates
  to service_role;
grant select, insert, update on table public.trending_hook_generation_run_chunks
  to service_role;

create or replace function public.create_or_resume_trending_hook_generation_run_v1(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_prompt_version text,
  p_selection_version text,
  p_source_selection_key text,
  p_target_valid_count integer,
  p_candidate_pool jsonb
)
returns table (
  run_id uuid,
  run_status text,
  target_valid_count integer,
  completed_valid_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_scope_key text;
  v_candidate_count integer;
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or coalesce(p_business_profile_version, 0) < 1
    or char_length(trim(coalesce(p_prompt_version, ''))) = 0
    or char_length(trim(coalesce(p_selection_version, ''))) = 0
    or coalesce(p_target_valid_count, 0) not between 1 and 100
    or jsonb_typeof(p_candidate_pool) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_input';
  end if;

  v_candidate_count := jsonb_array_length(p_candidate_pool);

  -- The run stores source metadata only. A physical worker still reserves no
  -- more than six candidates, but a larger pool prevents an early false
  -- "source exhausted" result after normal review rejections.
  if v_candidate_count < 1 or v_candidate_count > 600
    or exists (
      select 1
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
      where jsonb_typeof(candidate.value) <> 'object'
        or char_length(trim(coalesce(candidate.value ->> 'influencerVideoId', ''))) = 0
    )
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
    ) <> v_candidate_count
  then
    raise exception 'trending_hook_generation_run_invalid_candidates';
  end if;

  v_scope_key := concat_ws(
    ':',
    p_user_id,
    p_business_profile_id::text,
    p_business_profile_version::text
  );
  perform pg_advisory_xact_lock(hashtextextended(v_scope_key, 0));

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.user_id = p_user_id
    and run.business_profile_id = p_business_profile_id
    and run.business_profile_version = p_business_profile_version
    and run.status in ('queued', 'processing', 'continuation_pending')
  order by run.created_at desc
  limit 1
  for update;

  if found and v_run.source_selection_key <> coalesce(p_source_selection_key, '') then
    update public.trending_hook_generation_runs
    set
      status = 'superseded',
      last_error = 'The Hook-video source selection changed before this run completed.',
      updated_at = now()
    where id = v_run.id;
    v_run := null;
  end if;

  if v_run.id is null then
    insert into public.trending_hook_generation_runs (
      user_id,
      business_profile_id,
      business_profile_version,
      prompt_version,
      selection_version,
      source_selection_key,
      target_valid_count,
      status
    ) values (
      trim(p_user_id),
      p_business_profile_id,
      p_business_profile_version,
      trim(p_prompt_version),
      trim(p_selection_version),
      coalesce(p_source_selection_key, ''),
      p_target_valid_count,
      'queued'
    )
    returning * into v_run;

    insert into public.trending_hook_generation_run_candidates (
      run_id,
      influencer_video_id,
      candidate_order,
      candidate_payload
    )
    select
      v_run.id,
      trim(candidate.value ->> 'influencerVideoId'),
      candidate.ordinality - 1,
      candidate.value
    from jsonb_array_elements(p_candidate_pool)
      with ordinality as candidate(value, ordinality);
  end if;

  return query
  select
    v_run.id,
    v_run.status,
    v_run.target_valid_count,
    v_run.completed_valid_count;
end;
$$;

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
    from public.trending_hook_generation_run_candidates
    where run_id = v_run.id
      and state = 'pending'
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

  select coalesce(max(chunk_number), 0) + 1
  into v_chunk_number
  from public.trending_hook_generation_run_chunks
  where run_id = v_run.id;

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

create or replace function public.attach_trending_hook_generation_chunk_job_v1(
  p_chunk_id uuid,
  p_background_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_chunk_id is null or p_background_job_id is null then
    raise exception 'trending_hook_generation_chunk_attachment_invalid_input';
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
  for update;

  if not found or v_chunk.status <> 'reserved' then
    return false;
  end if;

  if v_chunk.background_job_id is not null
    and v_chunk.background_job_id <> p_background_job_id
    and not exists (
      select 1
      from public.background_jobs as job
      where job.id = v_chunk.background_job_id
        and job.status in ('failed', 'cancelled')
    )
  then
    return false;
  end if;

  update public.trending_hook_generation_run_chunks
  set
    background_job_id = p_background_job_id,
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'processing',
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'continuation_pending');

  return true;
end;
$$;

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

  update public.trending_hook_generation_runs
  set
    completed_valid_count = completed_valid_count + v_accepted_count,
    status = case
      when completed_valid_count + v_accepted_count >= target_valid_count then 'completed'
      else 'continuation_pending'
    end,
    completed_at = case
      when completed_valid_count + v_accepted_count >= target_valid_count then now()
      else null
    end,
    last_error = null,
    updated_at = now()
  where id = p_run_id
  returning * into v_run;

  return query
  select
    v_accepted_count,
    false,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
    v_run.status;
end;
$$;

create or replace function public.fail_trending_hook_generation_chunk_v1(
  p_job_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_job_id is null then
    return false;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.background_job_id = p_job_id
  for update;

  if not found or v_chunk.status = 'completed' then
    return false;
  end if;

  update public.trending_hook_generation_run_candidates
  set
    state = 'pending',
    chunk_id = null,
    updated_at = now()
  where run_id = v_chunk.run_id
    and chunk_id = v_chunk.id
    and state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    status = 'failed',
    last_error = left(coalesce(p_error_message, 'The Hook generation worker failed.'), 1_000),
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'continuation_pending',
    last_error = left(coalesce(p_error_message, 'The Hook generation worker failed.'), 1_000),
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'processing', 'continuation_pending');

  return true;
end;
$$;

-- If creating the physical background job succeeds but attaching that job to
-- its reserved chunk does not, no worker can ever claim the chunk. Release
-- only an unattached reservation so a later reconciliation can safely reserve
-- the same candidates again. Attached chunks are recovered by the terminal
-- background-job trigger below.
create or replace function public.release_unattached_trending_hook_generation_chunk_v1(
  p_chunk_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_chunk_id is null then
    return false;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
  for update;

  if not found
    or v_chunk.status <> 'reserved'
    or v_chunk.background_job_id is not null
  then
    return false;
  end if;

  update public.trending_hook_generation_run_candidates
  set
    state = 'pending',
    chunk_id = null,
    updated_at = now()
  where run_id = v_chunk.run_id
    and chunk_id = v_chunk.id
    and state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    status = 'failed',
    last_error = left(coalesce(p_error_message, 'The Hook generation task could not be attached.'), 1_000),
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'continuation_pending',
    last_error = left(coalesce(p_error_message, 'The Hook generation task could not be attached.'), 1_000),
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'processing', 'continuation_pending');

  return true;
end;
$$;

-- The normal completed-job reconciliation already wakes the next Hook chunk.
-- A terminal physical worker failure also needs that durable wake-up so the
-- parent run can retry instead of remaining reserved forever.
create or replace function public.enqueue_completed_trending_feed_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- This trigger is the durable authority for a terminal physical-job
  -- failure. It releases the chunk before the reconciliation outbox wakes
  -- the next one, so continuation never depends on a second worker call.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_trending_hook_copy'
    and new.input_json ? 'generationRunId'
  then
    perform public.fail_trending_hook_generation_chunk_v1(
      new.id,
      coalesce(new.error_message, 'The Hook generation worker failed.')
    );
  end if;

  insert into public.trending_feed_reconciliation_outbox (
    source_job_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (source_job_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_completed_trending_feed_reconciliation
  on public.background_jobs;

create trigger enqueue_completed_trending_feed_reconciliation
after update of status on public.background_jobs
for each row
when (
  old.status is distinct from new.status
  and new.user_id is not null
  and (
    (
      new.status = 'completed'
      and new.job_type in (
        'carousel_content_plan_generation',
        'generate_carousel',
        'generate_trending_hook_copy',
        'wall_text_content_plan_generation',
        'wall_text_generation'
      )
    )
    or (
      new.status in ('failed', 'cancelled')
      and new.job_type = 'generate_trending_hook_copy'
      and new.input_json ? 'generationRunId'
    )
  )
)
execute function public.enqueue_completed_trending_feed_reconciliation();

revoke all on function public.create_or_resume_trending_hook_generation_run_v1(
  text, uuid, integer, text, text, text, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.reserve_trending_hook_generation_chunk_v1(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.attach_trending_hook_generation_chunk_job_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.persist_trending_hook_generation_chunk_v1(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.fail_trending_hook_generation_chunk_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.release_unattached_trending_hook_generation_chunk_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_or_resume_trending_hook_generation_run_v1(
  text, uuid, integer, text, text, text, integer, jsonb
) to service_role;
grant execute on function public.reserve_trending_hook_generation_chunk_v1(uuid, integer)
  to service_role;
grant execute on function public.attach_trending_hook_generation_chunk_job_v1(uuid, uuid)
  to service_role;
grant execute on function public.persist_trending_hook_generation_chunk_v1(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb
) to service_role;
grant execute on function public.fail_trending_hook_generation_chunk_v1(uuid, text)
  to service_role;
grant execute on function public.release_unattached_trending_hook_generation_chunk_v1(uuid, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
