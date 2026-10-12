-- Add a service-only advanced reservation path. The strict V1 function is unchanged.
-- Existing billing/job functions remain authoritative and run in the same transaction.
create function public.mcp_create_reserved_advanced_generation_job(
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
security invoker
set search_path = ''
as $function$
declare
  v_existing_job public.background_jobs%rowtype;
  v_reservation_id uuid;
  v_result jsonb;
  v_group_key text;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null
     or nullif(pg_catalog.btrim(p_idempotency_key), '') is null
     or pg_catalog.length(p_idempotency_key) > 200
     or p_queue_name is distinct from 'ai-generation'
     or p_amount is null or p_amount < 1
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(p_input_json) is distinct from 'object'
     or p_input_json->>'mcpValidatedInputFingerprint' is null
     or p_input_json->>'mcpValidatedInputFingerprint' !~ '^[a-f0-9]{64}$'
     or p_input_json->>'mcpGenerationContract' is distinct from 'advanced-v1'
     or p_input_json->>'userId' is distinct from p_user_id
     or p_input_json->>'projectId' is distinct from 'ai-studio'
     or p_input_json->>'mcpClientRequestId' is null
     or p_input_json->>'mcpClientRequestId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or pg_catalog.jsonb_typeof(p_input_json->'batchSize') is distinct from 'number'
     or p_input_json->>'batchSize' is null or p_input_json->>'batchSize' not in ('1','2','4')
     or pg_catalog.jsonb_typeof(p_input_json->'batchIndex') is distinct from 'number'
     or p_input_json->>'batchIndex' is null or p_input_json->>'batchIndex' not in ('1','2','3','4')
     or (p_input_json->>'batchIndex')::integer > (p_input_json->>'batchSize')::integer
     or pg_catalog.right(p_idempotency_key, 1) is distinct from p_input_json->>'batchIndex'
     or p_input_json->>'mcpSource' is distinct from 'ugc-pilot-cloud-mcp'
     or p_input_json->>'mcpRequestFingerprint' is distinct from p_fingerprint
     or p_job_type is null
     or not (
       (p_job_type = 'generate_image' and p_idempotency_key ~ '^mcp:image:[0-9a-f]{64}:[1-4]$')
       or (p_job_type = 'generate_hook_video' and p_idempotency_key ~ '^mcp:video:[0-9a-f]{64}:[1-4]$')
     ) then
    raise exception 'mcp_generation_input_invalid';
  end if;

  if p_job_type = 'generate_image' and (
    p_input_json->>'model' is null or p_input_json->>'model' not in ('nano_banana_2','seedream_5_pro','gpt_image_2_5')
    or p_input_json->>'aspectRatio' is null or p_input_json->>'aspectRatio' not in ('4:5','1:1','9:16','16:9')
    or nullif(pg_catalog.btrim(p_input_json->>'prompt'), '') is null
    or (p_input_json ? 'exploreFormat' and p_input_json->>'exploreFormat' is distinct from 'slideshow')
    or (p_input_json->>'model' = 'gpt_image_2_5' and p_input_json->>'exploreFormat' is distinct from 'slideshow')
    or (p_input_json->>'model' = 'seedream_5_pro' and p_input_json->>'exploreFormat' = 'slideshow')
  ) then raise exception 'mcp_generation_input_invalid'; end if;

  if p_job_type = 'generate_hook_video' and (
    p_input_json->>'promptMode' is distinct from 'direct'
    or p_input_json->>'model' is null or p_input_json->>'model' not in ('google_omni','kling_3_0','seedance_2_5','wan_3_0')
    or p_input_json->>'aspectRatio' is null or p_input_json->>'aspectRatio' not in ('9:16','16:9')
    or pg_catalog.jsonb_typeof(p_input_json->'durationSeconds') is distinct from 'number'
    or p_input_json->>'durationSeconds' is null or p_input_json->>'durationSeconds' !~ '^([2-9]|[12][0-9]|30)$'
    or p_input_json->>'resolution' is null or p_input_json->>'resolution' not in ('480p','720p','1080p')
    or nullif(pg_catalog.btrim(p_input_json->>'hookIdea'), '') is null
    or (p_input_json ? 'exploreFormat' and (p_input_json->>'exploreFormat' is null or p_input_json->>'exploreFormat' not in ('hook','wall_text')))
    or (p_input_json ? 'exploreFormat' and p_input_json->>'model' not in ('google_omni','wan_3_0'))
    or (p_input_json->>'model' = 'google_omni' and (p_input_json->>'resolution' not in ('720p','1080p') or (p_input_json->>'durationSeconds')::integer not between 3 and 10))
    or (p_input_json->>'model' = 'kling_3_0' and (p_input_json->>'resolution' <> '720p' or p_input_json->>'durationSeconds' not in ('3','4','5','6','7','8','9','10','15')))
    or (p_input_json->>'model' = 'seedance_2_5' and (p_input_json->>'resolution' not in ('480p','720p') or (p_input_json->>'durationSeconds')::integer not between 4 and 30))
  ) then raise exception 'mcp_generation_input_invalid'; end if;

  v_group_key := pg_catalog.left(p_idempotency_key,pg_catalog.length(p_idempotency_key)-2);

  -- Serialize every child of this batch across simultaneous calls. Neither the
  -- website route nor the existing billing/job functions need to change.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mcp-advanced-batch:' || p_user_id || ':' || v_group_key, 0)
  );

  select job.* into v_existing_job
  from public.background_jobs as job
  where job.user_id = p_user_id
    and job.job_type = p_job_type
    and job.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_job.input_json->>'mcpGenerationContract' is distinct from 'advanced-v1'
       or v_existing_job.input_json->>'mcpRequestFingerprint' is distinct from p_fingerprint
       or v_existing_job.input_json->>'mcpValidatedInputFingerprint' is distinct from p_input_json->>'mcpValidatedInputFingerprint' then
      raise exception 'mcp_generation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object('created', false, 'job', pg_catalog.to_jsonb(v_existing_job));
  end if;

  -- All sibling outputs share one validated reference/price snapshot, including
  -- concurrent and partial retries. Never mix a later changed catalogue or file.
  select job.* into v_existing_job from public.background_jobs as job
  where job.user_id=p_user_id and job.job_type=p_job_type
    and job.idempotency_key in (v_group_key || ':1',v_group_key || ':2',v_group_key || ':3',v_group_key || ':4')
  limit 1;
  if found and (
    v_existing_job.input_json->>'mcpGenerationContract' is distinct from 'advanced-v1'
    or v_existing_job.input_json->>'mcpRequestFingerprint' is distinct from p_fingerprint
    or v_existing_job.input_json->>'mcpValidatedInputFingerprint' is distinct from p_input_json->>'mcpValidatedInputFingerprint'
  ) then raise exception 'mcp_generation_idempotency_conflict'; end if;

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

revoke all on function public.mcp_create_reserved_advanced_generation_job(
  text, text, text, integer, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.mcp_create_reserved_advanced_generation_job(
  text, text, text, integer, text, jsonb, text
) to service_role;

select pg_notify('pgrst', 'reload schema');
