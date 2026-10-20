-- Add MCP V1 video jobs without changing image reservations or retry keys.
-- MCP generation retries must not separate a credit reservation from the job
-- that owns it. Keep the existing billing and job functions as the source of
-- truth and call both within this one PostgREST transaction.
create or replace function public.mcp_create_reserved_generation_job(
  p_user_id text,
  p_idempotency_key text,
  p_job_type text,
  p_amount integer,
  p_fingerprint text,
  p_input_json jsonb,
  p_queue_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_job public.background_jobs%rowtype;
  v_reservation_id uuid;
  v_result jsonb;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null
     or nullif(pg_catalog.btrim(p_idempotency_key), '') is null
     or pg_catalog.length(p_idempotency_key) > 200
     or p_queue_name is distinct from 'ai-generation'
     or p_amount is null or p_amount < 1
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(p_input_json) is distinct from 'object'
     or p_input_json->>'mcpSource' is distinct from 'ugc-pilot-cloud-mcp'
     or p_input_json->>'mcpRequestFingerprint' is distinct from p_fingerprint
     or p_job_type is null
     or not (
       (p_job_type = 'generate_image' and p_idempotency_key ~ '^mcp:image:[0-9a-f]{64}:[1-4]$')
       or (p_job_type = 'generate_hook_video' and p_idempotency_key ~ '^mcp:video:[0-9a-f]{64}:[1-4]$')
     ) then
    raise exception 'mcp_generation_input_invalid';
  end if;

  if p_job_type = 'generate_hook_video' and (
    p_input_json->>'promptMode' is distinct from 'direct'
    or p_input_json->>'userId' is distinct from p_user_id
    or p_input_json->>'projectId' is distinct from 'ai-studio'
    or p_input_json->>'model' is distinct from 'google_omni'
    or p_input_json->>'aspectRatio' is null
    or p_input_json->>'aspectRatio' not in ('9:16', '16:9')
    or pg_catalog.jsonb_typeof(p_input_json->'durationSeconds') is distinct from 'number'
    or p_input_json->>'durationSeconds' not in ('3','4','5','6','7','8','9','10')
    or nullif(pg_catalog.btrim(p_input_json->>'hookIdea'), '') is null
    or pg_catalog.length(p_input_json->>'hookIdea') > 1000
    or p_input_json ? 'referenceVideoUrl'
  ) then
    raise exception 'mcp_generation_input_invalid';
  end if;

  -- Serialize the same MCP child across simultaneous tool calls. Neither the
  -- website route nor the existing billing/job functions need to change.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mcp-generation:' || p_user_id || ':' || p_idempotency_key, 0)
  );

  select job.* into v_existing_job
  from public.background_jobs as job
  where job.user_id = p_user_id
    and job.job_type = p_job_type
    and job.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_job.input_json->>'mcpRequestFingerprint' is distinct from p_fingerprint then
      raise exception 'mcp_generation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object('created', false, 'job', pg_catalog.to_jsonb(v_existing_job));
  end if;

  -- The existing reservation function also takes this per-user lock. Holding
  -- it before checking for a stray reservation closes the check/create race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0)
  );

  select reservation.id into v_reservation_id
  from public.billing_credit_reservations as reservation
  where reservation.user_id = p_user_id
    and reservation.idempotency_key = p_idempotency_key;
  if found then
    raise exception 'mcp_generation_reservation_conflict';
  end if;

  perform public.reserve_billing_credits(
    p_user_id, p_idempotency_key, p_job_type, p_amount
  );

  v_result := public.create_or_get_background_job_v1(
    p_idempotency_key,
    p_input_json,
    null,
    p_job_type,
    3,
    'ai-studio',
    p_queue_name,
    p_user_id
  );

  -- Another path should never create an MCP-keyed job while this function is
  -- running. Roll back the reservation if it does.
  if v_result->>'created' is distinct from 'true' then
    raise exception 'mcp_generation_job_conflict';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.mcp_create_reserved_generation_job(
  text, text, text, integer, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.mcp_create_reserved_generation_job(
  text, text, text, integer, text, jsonb, text
) to service_role;

select pg_notify('pgrst', 'reload schema');
