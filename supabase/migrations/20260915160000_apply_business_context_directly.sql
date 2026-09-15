-- A Settings user applies the exact fields visible in the Business Context
-- form. This is one atomic version promotion, so a failed apply leaves the
-- active context and its previously generated content untouched.

-- The background-onboarding guard intentionally rejects old profile writers
-- once a durable onboarding draft exists. Permit only this dedicated,
-- transaction-scoped Business Context promotion; legacy writers remain fenced.
create or replace function public.guard_background_onboarding_profile_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_draft_id uuid;
begin
  if tg_op='UPDATE' and row(new.context_json,new.analysis_id,new.onboarding_status,new.onboarding_step,
      new.onboarding_version,new.onboarding_completed_at,new.primary_goals,new.logo_storage_key)
    is not distinct from row(old.context_json,old.analysis_id,old.onboarding_status,old.onboarding_step,
      old.onboarding_version,old.onboarding_completed_at,old.primary_goals,old.logo_storage_key) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-onboarding:' || new.user_id,0));
  select id into v_draft_id from public.business_onboarding_drafts where user_id=new.user_id;
  if v_draft_id is not null
    and current_setting('ugc.onboarding_draft_writer',true) is distinct from v_draft_id::text
    and current_setting('ugc.business_context_writer', true) is distinct from 'apply_business_context_v1' then
    raise exception 'onboarding_legacy_write_rejected';
  end if;
  return new;
end;
$$;

create or replace function public.apply_business_context_v1(
  p_content_hash text,
  p_context_json jsonb,
  p_expected_draft_updated_at timestamptz,
  p_expected_profile_version integer,
  p_user_id text
)
returns setof public.business_profiles
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_profile public.business_profiles%rowtype;
begin
  if nullif(btrim(p_user_id), '') is null then
    raise exception 'business_context_owner_required';
  end if;
  if p_expected_profile_version < 1 then
    raise exception 'business_context_profile_conflict';
  end if;
  if jsonb_typeof(p_context_json) is distinct from 'object' then
    raise exception 'business_context_invalid';
  end if;
  if nullif(btrim(p_content_hash), '') is null then
    raise exception 'business_context_invalid';
  end if;

  -- This setting exists only for this transaction and is checked by the
  -- onboarding guard above. No normal Settings write bypasses that guard.
  perform set_config('ugc.business_context_writer', 'apply_business_context_v1', true);

  update public.business_profiles as profile
  set business_context_draft_base_version = null,
      business_context_draft_json = null,
      business_context_draft_source = null,
      business_context_draft_updated_at = null,
      content_hash = p_content_hash,
      context_json = p_context_json,
      profile_version = p_expected_profile_version + 1,
      updated_at = now()
  where profile.user_id = p_user_id
    and profile.profile_version = p_expected_profile_version
    and profile.business_context_draft_updated_at is not distinct from p_expected_draft_updated_at
    and (
      profile.business_context_draft_json is null
      or profile.business_context_draft_base_version = p_expected_profile_version
    )
  returning * into v_profile;

  if not found then
    raise exception 'business_context_draft_conflict';
  end if;
  return next v_profile;
  return;
end;
$$;

revoke all on function public.apply_business_context_v1(text, jsonb, timestamptz, integer, text)
  from public, anon, authenticated;
grant execute on function public.apply_business_context_v1(text, jsonb, timestamptz, integer, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
