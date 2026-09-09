-- A committed Wall-plan publication is a durable outbox event. Cloud Tasks
-- retries its exact event in seconds; the five-minute recovery scan continues
-- to claim only missed or stale events as a safety net.

drop function if exists public.claim_wall_text_plan_publications(integer, uuid);

create function public.claim_wall_text_plan_publications(
  p_limit integer default 10,
  p_plan_id uuid default null,
  p_publication_id uuid default null
)
returns setof public.wall_text_plan_publications
language plpgsql
set search_path = ''
as $$
begin
  return query
  with due as (
    select e.id
    from public.wall_text_plan_publications e
    where (p_plan_id is null or e.plan_id = p_plan_id)
      and (p_publication_id is null or e.id = p_publication_id)
      and (
        (e.status = 'pending' and e.next_attempt_at <= now())
        or (e.status = 'processing' and e.locked_at < now() - interval '5 minutes')
      )
    order by e.next_attempt_at, e.created_at
    limit greatest(1, least(coalesce(p_limit, 10), 25))
    for update skip locked
  )
  update public.wall_text_plan_publications e
  set
    status = 'processing',
    claim_token = gen_random_uuid(),
    locked_at = now(),
    attempt_count = e.attempt_count + 1
  from due
  where e.id = due.id
  returning e.*;
end;
$$;

create or replace function public.finish_wall_text_plan_publication(
  p_id uuid,
  p_claim_token uuid,
  p_error text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.wall_text_plan_publications
  set
    status = case when p_error is null then 'completed' else 'pending' end,
    completed_at = case when p_error is null then now() else null end,
    -- This matches the Cloud Tasks queue's ten-second minimum backoff. The
    -- five-minute recovery scan remains a crash and legacy safety net only.
    next_attempt_at = case
      when p_error is null then next_attempt_at
      else now() + interval '10 seconds'
    end,
    last_error = left(p_error, 1000),
    claim_token = null,
    locked_at = null
  where id = p_id
    and status = 'processing'
    and claim_token = p_claim_token;

  return found;
end;
$$;

revoke all on function public.claim_wall_text_plan_publications(integer, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_wall_text_plan_publications(integer, uuid, uuid)
  to service_role;

revoke all on function public.finish_wall_text_plan_publication(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finish_wall_text_plan_publication(uuid, uuid, text)
  to service_role;
