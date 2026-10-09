-- Select 1-3 images and reserve every new batch against the shared Explore credit balance.
-- Preserve old one-image job replays, but never issue another separate free allowance.
create or replace function public.character_create_reserved_generation_batch(
  p_user_id text,
  p_idempotency_key text,
  p_fingerprint text,
  p_amount_per_image integer,
  p_inputs_json jsonb,
  p_queue_name text,
  p_use_free_allowance boolean default false
)
returns table(created boolean, job jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_existing_count integer;
  v_index integer;
  v_key text;
  v_input jsonb;
  v_result jsonb;
  v_existing public.background_jobs%rowtype;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null
     or p_idempotency_key is null or p_idempotency_key !~ '^[0-9a-f]{64}$'
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_queue_name is distinct from 'ai-generation'
     or p_use_free_allowance is null
     or pg_catalog.jsonb_typeof(p_inputs_json) is distinct from 'array' then
    raise exception 'character_generation_input_invalid';
  end if;
  v_count := pg_catalog.jsonb_array_length(p_inputs_json);
  if (p_use_free_allowance and (v_count <> 1 or p_amount_per_image is distinct from 0))
     or (not p_use_free_allowance and ((v_count < 1 or v_count > 3) or p_amount_per_image is null or p_amount_per_image < 1)) then
    raise exception 'character_generation_input_invalid';
  end if;

  for v_index in 1..v_count loop
    v_input := p_inputs_json->(v_index - 1);
    if pg_catalog.jsonb_typeof(v_input) is distinct from 'object'
       or v_input->>'characterSource' is distinct from 'ugc-pilot-characters'
       or v_input->>'characterVersion' is distinct from '1'
       or pg_catalog.jsonb_typeof(v_input->'characterVersion') is distinct from 'number'
       or v_input->>'characterRequestFingerprint' is distinct from p_fingerprint
       or v_input->>'batchId' is distinct from p_idempotency_key
       or v_input->>'candidateIndex' is distinct from v_index::text
       or pg_catalog.jsonb_typeof(v_input->'candidateIndex') is distinct from 'number'
       or v_input->>'batchSize' is distinct from v_count::text
       or pg_catalog.jsonb_typeof(v_input->'batchSize') is distinct from 'number'
       or coalesce(v_input->>'model', '') not in ('gpt_image', 'gemini_3_pro', 'nano_banana_2')
       or pg_catalog.jsonb_typeof(v_input->'generationId') is distinct from 'string'
       or coalesce(v_input->>'generationId', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or pg_catalog.jsonb_typeof(v_input->'prompt') is distinct from 'string'
       or nullif(pg_catalog.btrim(v_input->>'prompt'), '') is null
       or pg_catalog.length(v_input->>'prompt') > 2000
       or pg_catalog.jsonb_typeof(v_input->'characterSpec') is distinct from 'object'
       or (p_use_free_allowance and (
         v_input->>'mode' is distinct from 'assisted'
         or nullif(v_input->>'referenceCharacterId', '') is not null
         or nullif(v_input->>'referenceImageUrl', '') is not null
       )) then
      raise exception 'character_generation_input_invalid';
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('character-generation:' || p_user_id || ':' || p_idempotency_key, 0)
  );
  select count(*)::integer into v_existing_count from public.background_jobs as jobs
  where jobs.user_id = p_user_id and jobs.job_type = 'generate_image'
    and jobs.idempotency_key like 'character:' || p_idempotency_key || ':%';
  if v_existing_count > 0 then
    if v_existing_count <> v_count then
      raise exception 'character_generation_idempotency_conflict';
    end if;
    for v_index in 1..v_count loop
      select jobs.* into v_existing from public.background_jobs as jobs
      where jobs.user_id = p_user_id and jobs.job_type = 'generate_image'
        and jobs.idempotency_key = 'character:' || p_idempotency_key || ':' || v_index::text;
      if not found or v_existing.input_json->>'characterRequestFingerprint' is distinct from p_fingerprint
         or v_existing.input_json->>'characterSource' is distinct from 'ugc-pilot-characters' then
        raise exception 'character_generation_idempotency_conflict';
      end if;
      created := false;
      job := pg_catalog.to_jsonb(v_existing);
      return next;
    end loop;
    return;
  end if;

  -- Existing jobs return above, including historical zero-cost jobs.
  -- New free and paid requests always use reserve_billing_credits.
  if p_use_free_allowance then
    raise exception 'character_legacy_allowance_unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0)
  );
  for v_index in 1..v_count loop
    v_key := 'character:' || p_idempotency_key || ':' || v_index::text;
    if exists (select 1 from public.billing_credit_reservations as reservations
               where reservations.user_id = p_user_id and reservations.idempotency_key = v_key) then
      raise exception 'character_generation_reservation_conflict';
    end if;
    perform public.reserve_billing_credits(p_user_id, v_key, 'generate_image', p_amount_per_image);
    v_result := public.create_or_get_background_job_v1(
      v_key, p_inputs_json->(v_index - 1), null, 'generate_image', 3, 'ai-studio', p_queue_name, p_user_id
    );
    if v_result->>'created' is distinct from 'true' then
      raise exception 'character_generation_job_conflict';
    end if;
    created := true;
    job := v_result->'job';
    return next;
  end loop;
end;
$function$;

revoke all on function public.character_create_reserved_generation_batch(text, text, text, integer, jsonb, text, boolean)
from public, anon, authenticated;
grant execute on function public.character_create_reserved_generation_batch(text, text, text, integer, jsonb, text, boolean)
to service_role;
select pg_notify('pgrst', 'reload schema');

