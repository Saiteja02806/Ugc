-- Additive Explore-only request receipts. Existing AI Studio/MCP keys and APIs
-- are unchanged. The Firebase owner is supplied only by verified server code.
create table public.explore_generation_requests (
  user_id text not null check (length(btrim(user_id)) > 0),
  request_key uuid not null,
  workflow_kind text not null check (workflow_kind in ('hook', 'phone')),
  quantity integer not null check (quantity in (1, 2, 4)),
  fingerprint text check (fingerprint ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('creating', 'accepted', 'not_started')),
  job_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, request_key),
  constraint explore_generation_receipt_complete check (
    (outcome = 'creating' and fingerprint is not null and cardinality(job_ids) = 0)
    or (outcome = 'accepted' and fingerprint is not null and cardinality(job_ids) = quantity)
    or (outcome = 'not_started' and fingerprint is null and cardinality(job_ids) = 0)
  )
);
alter table public.explore_generation_requests enable row level security;
revoke all on public.explore_generation_requests from public, anon, authenticated;
grant select, insert, update on public.explore_generation_requests to service_role;

-- Fence the reserved namespace even if another existing API is called directly
-- with an Explore key. Only this transaction's creating receipt permits insert.
create function public.guard_explore_generation_job_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare v_receipt public.explore_generation_requests; v_request_key uuid; v_index integer;
begin
  if new.job_type <> 'generate_hook_video' or coalesce(new.idempotency_key, '') not like 'explore:%' then return new; end if;
  if new.idempotency_key !~ '^explore:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:[1-4]$' then
    raise exception 'explore_generation_input_invalid';
  end if;
  v_request_key := pg_catalog.split_part(new.idempotency_key, ':', 2)::uuid;
  v_index := pg_catalog.split_part(new.idempotency_key, ':', 3)::integer;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'explore-generation:' || new.user_id || ':' || v_request_key::text, 0));
  select * into v_receipt from public.explore_generation_requests where user_id = new.user_id and request_key = v_request_key;
  if not found or v_receipt.outcome <> 'creating' or v_index > v_receipt.quantity
     or new.project_id is distinct from 'ai-studio'
     or new.input_json->>'workflowRequestKey' is distinct from v_request_key::text
     or new.input_json->>'workflowRequestFingerprint' is distinct from v_receipt.fingerprint
     or new.input_json->>'workflowKind' is distinct from v_receipt.workflow_kind
     or new.input_json->>'batchIndex' is distinct from v_index::text
     or new.input_json->>'batchSize' is distinct from v_receipt.quantity::text then
    raise exception 'explore_generation_request_closed';
  end if;
  return new;
end;
$function$;
revoke all on function public.guard_explore_generation_job_insert() from public, anon, authenticated;
grant execute on function public.guard_explore_generation_job_insert() to service_role;
create trigger guard_explore_generation_job_insert before insert on public.background_jobs
for each row execute function public.guard_explore_generation_job_insert();

create function public.explore_create_reserved_generation_batch(
  p_user_id text, p_request_key uuid, p_workflow_kind text,
  p_fingerprint text, p_amount_per_video integer, p_inputs_json jsonb
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_count integer;
  v_index integer;
  v_key text;
  v_input jsonb;
  v_result jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_ids uuid[] := '{}';
  v_receipt public.explore_generation_requests;
  v_job public.background_jobs;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_request_key is null
     or p_workflow_kind is null or p_workflow_kind not in ('hook', 'phone')
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_amount_per_video is null or p_amount_per_video < 1
     or pg_catalog.jsonb_typeof(p_inputs_json) is distinct from 'array' then
    raise exception 'explore_generation_input_invalid';
  end if;
  v_count := pg_catalog.jsonb_array_length(p_inputs_json);
  if v_count not in (1, 2, 4) then raise exception 'explore_generation_input_invalid'; end if;
  for v_index in 1..v_count loop
    v_input := p_inputs_json->(v_index - 1);
    if pg_catalog.jsonb_typeof(v_input) is distinct from 'object'
       or v_input->>'userId' is distinct from p_user_id
       or v_input->>'projectId' is distinct from 'ai-studio'
       or v_input->>'promptMode' is distinct from 'direct'
       or v_input->>'workflowKind' is distinct from p_workflow_kind
       or v_input->>'workflowRequestKey' is distinct from p_request_key::text
       or v_input->>'workflowRequestFingerprint' is distinct from p_fingerprint
       or v_input->>'batchSize' is distinct from v_count::text
       or pg_catalog.jsonb_typeof(v_input->'batchSize') is distinct from 'number'
       or v_input->>'batchIndex' is distinct from v_index::text
       or pg_catalog.jsonb_typeof(v_input->'batchIndex') is distinct from 'number'
       or coalesce(v_input->>'videoId', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
       or nullif(pg_catalog.btrim(v_input->>'hookIdea'), '') is null then
      raise exception 'explore_generation_input_invalid';
    end if;
  end loop;
  if (select count(distinct item->>'videoId') from pg_catalog.jsonb_array_elements(p_inputs_json) item) <> v_count then
    raise exception 'explore_generation_input_invalid';
  end if;

  -- The same transaction lock fences an unreceived request before any credit
  -- reservation or job creation. A late POST cannot cross a not_started receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'explore-generation:' || p_user_id || ':' || p_request_key::text, 0));
  select * into v_receipt from public.explore_generation_requests
  where user_id = p_user_id and request_key = p_request_key;
  if found then
    if v_receipt.workflow_kind is distinct from p_workflow_kind or v_receipt.quantity <> v_count
       or v_receipt.outcome <> 'accepted' or v_receipt.fingerprint is distinct from p_fingerprint then
      raise exception 'explore_generation_idempotency_conflict';
    end if;
    foreach v_key in array array(select unnest(v_receipt.job_ids)::text) loop
      select * into v_job from public.background_jobs where id = v_key::uuid
        and user_id = p_user_id and job_type = 'generate_hook_video' and project_id = 'ai-studio';
      if not found or v_job.input_json->>'workflowRequestFingerprint' is distinct from p_fingerprint then
        raise exception 'explore_generation_receipt_invalid';
      end if;
      v_jobs := v_jobs || pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_job));
    end loop;
    return pg_catalog.jsonb_build_object('created', false, 'jobs', v_jobs);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0));
  insert into public.explore_generation_requests(user_id, request_key, workflow_kind, quantity, fingerprint, outcome)
  values(p_user_id, p_request_key, p_workflow_kind, v_count, p_fingerprint, 'creating');
  for v_index in 1..v_count loop
    v_key := 'explore:' || p_request_key::text || ':' || v_index::text;
    if exists(select 1 from public.billing_credit_reservations where user_id = p_user_id and idempotency_key = v_key) then
      raise exception 'explore_generation_reservation_conflict';
    end if;
    perform public.reserve_billing_credits(p_user_id, v_key, 'generate_hook_video', p_amount_per_video);
    v_result := public.create_or_get_background_job_v1(v_key, p_inputs_json->(v_index - 1), null,
      'generate_hook_video', 3, 'ai-studio', 'ai-generation', p_user_id);
    if v_result->>'created' is distinct from 'true' then raise exception 'explore_generation_job_conflict'; end if;
    v_ids := pg_catalog.array_append(v_ids, (v_result->'job'->>'id')::uuid);
    v_jobs := v_jobs || pg_catalog.jsonb_build_array(v_result->'job');
  end loop;
  update public.explore_generation_requests set outcome = 'accepted', job_ids = v_ids
  where user_id = p_user_id and request_key = p_request_key;
  -- All reservations, all jobs and their receipt commit together, or roll back.
  return pg_catalog.jsonb_build_object('created', true, 'jobs', v_jobs);
end;
$function$;

create function public.explore_resolve_generation_request(
  p_user_id text, p_request_key uuid, p_workflow_kind text, p_quantity integer
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare v_receipt public.explore_generation_requests;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_request_key is null
     or p_workflow_kind is null or p_workflow_kind not in ('hook', 'phone')
     or p_quantity is null or p_quantity not in (1, 2, 4) then
    raise exception 'explore_generation_input_invalid';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'explore-generation:' || p_user_id || ':' || p_request_key::text, 0));
  select * into v_receipt from public.explore_generation_requests where user_id = p_user_id and request_key = p_request_key;
  if not found then
    insert into public.explore_generation_requests(user_id, request_key, workflow_kind, quantity, outcome)
    values(p_user_id, p_request_key, p_workflow_kind, p_quantity, 'not_started') returning * into v_receipt;
  end if;
  if v_receipt.workflow_kind is distinct from p_workflow_kind or v_receipt.quantity <> p_quantity then
    raise exception 'explore_generation_idempotency_conflict';
  end if;
  -- This closes only an unreceived request. Existing jobs are not cancelled,
  -- retried, redispatched or refunded, and no provider call is made.
  return pg_catalog.to_jsonb(v_receipt);
end;
$function$;
revoke all on function public.explore_create_reserved_generation_batch(text, uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.explore_resolve_generation_request(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.explore_create_reserved_generation_batch(text, uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.explore_resolve_generation_request(text, uuid, text, integer) to service_role;
select pg_notify('pgrst', 'reload schema');
