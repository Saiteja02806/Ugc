-- Add three-output Explore batches without changing existing request keys,
-- fingerprints, whole-batch credit reservations, RLS or service-only privileges.
alter table public.explore_generation_requests
  drop constraint explore_generation_requests_quantity_check;
alter table public.explore_generation_requests
  add constraint explore_generation_requests_quantity_check check (quantity in (1, 2, 3, 4));

create or replace function public.explore_create_reserved_generation_batch(
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
  if v_count not in (1, 2, 3, 4) then raise exception 'explore_generation_input_invalid'; end if;
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

create or replace function public.explore_resolve_generation_request(
  p_user_id text, p_request_key uuid, p_workflow_kind text, p_quantity integer
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare v_receipt public.explore_generation_requests;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_request_key is null
     or p_workflow_kind is null or p_workflow_kind not in ('hook', 'phone')
     or p_quantity is null or p_quantity not in (1, 2, 3, 4) then
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
