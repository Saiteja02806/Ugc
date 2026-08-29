-- Harden TikTok OAuth token rotation and publishing state transitions.
alter table public.social_connections
  add column if not exists refresh_expires_at timestamptz,
  add column if not exists token_refreshed_at timestamptz,
  add column if not exists token_refresh_claim_token uuid,
  add column if not exists token_refresh_claimed_at timestamptz;

update public.social_connections
set
  refresh_expires_at = coalesce(
    refresh_expires_at,
    connected_at + interval '365 days'
  ),
  token_refreshed_at = coalesce(token_refreshed_at, updated_at)
where platform = 'tiktok'
  and refresh_token_ciphertext is not null;

alter table public.social_connections
  drop constraint if exists social_connections_refresh_claim_check;

alter table public.social_connections
  add constraint social_connections_refresh_claim_check
  check (
    (token_refresh_claim_token is null and token_refresh_claimed_at is null)
    or
    (token_refresh_claim_token is not null and token_refresh_claimed_at is not null)
  );

create index if not exists social_connections_refresh_claim_idx
  on public.social_connections (token_refresh_claimed_at)
  where token_refresh_claim_token is not null;

alter table public.scheduled_post_targets
  drop constraint if exists scheduled_post_targets_status_check;

alter table public.scheduled_post_targets
  add constraint scheduled_post_targets_status_check
  check (
    status in (
      'draft',
      'scheduling',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'action_required',
      'cancelled',
      'skipped'
    )
  );

create or replace function public.cancel_scheduled_post(
  p_post_id uuid,
  p_user_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_post_status text;
begin
  select post.status
  into v_post_status
  from public.scheduled_posts as post
  where post.id = p_post_id
    and post.user_id = p_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  perform target.id
  from public.scheduled_post_targets as target
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
  order by target.id
  for update;

  if v_post_status = 'published'
    or exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.status = 'published'
    )
    or exists (
      select 1
      from public.social_publish_operations as operation
      join public.scheduled_post_targets as target
        on target.id = operation.scheduled_post_target_id
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and (
          operation.active_claim_token is not null
          or operation.status = 'published'
        )
    ) then
    return 'too_late';
  end if;

  update public.scheduled_posts as post
  set
    cancelled_at = v_now,
    last_error_code = null,
    status = 'cancelled',
    updated_at = v_now
  where post.id = p_post_id
    and post.user_id = p_user_id;

  update public.scheduled_post_targets as target
  set
    cancelled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
    and target.status in (
      'draft',
      'scheduling',
      'scheduled',
      'publishing',
      'failed',
      'action_required'
    );

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.publish_job_id = job.id
    );

  return 'cancelled';
end;
$$;

revoke all on function public.cancel_scheduled_post(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_scheduled_post(uuid, text)
  to service_role;

create or replace function public.claim_social_connection_token_refresh(
  p_connection_id uuid,
  p_user_id text,
  p_claim_token uuid,
  p_stale_after_seconds integer
)
returns setof public.social_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 120), 900)
  );
begin
  if p_claim_token is null then
    raise exception 'refresh claim token is required';
  end if;

  return query
  update public.social_connections as connection
  set
    token_refresh_claim_token = p_claim_token,
    token_refresh_claimed_at = v_now,
    updated_at = v_now
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.revoked_at is null
    and connection.status <> 'revoked'
    and connection.refresh_token_ciphertext is not null
    and (
      connection.token_refresh_claim_token is null
      or connection.token_refresh_claimed_at <
        v_now - make_interval(secs => v_stale_after_seconds)
      or connection.token_refresh_claim_token = p_claim_token
    )
  returning connection.*;
end;
$$;

create or replace function public.complete_social_connection_token_refresh(
  p_connection_id uuid,
  p_user_id text,
  p_claim_token uuid,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_scopes text[],
  p_token_type text,
  p_status text
)
returns setof public.social_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_status not in ('connected', 'permission_missing') then
    raise exception 'invalid refreshed connection status';
  end if;

  return query
  update public.social_connections as connection
  set
    access_token_ciphertext = p_access_token_ciphertext,
    refresh_token_ciphertext = p_refresh_token_ciphertext,
    expires_at = p_expires_at,
    refresh_expires_at = p_refresh_expires_at,
    scopes = coalesce(p_scopes, '{}'::text[]),
    token_type = p_token_type,
    status = p_status,
    last_error_code = null,
    token_refreshed_at = v_now,
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = v_now
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.token_refresh_claim_token = p_claim_token
    and connection.revoked_at is null
  returning connection.*;
end;
$$;

create or replace function public.release_social_connection_token_refresh(
  p_connection_id uuid,
  p_user_id text,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  update public.social_connections as connection
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    status = case
      when p_error_code in (
        'access_token_invalid',
        'account_mismatch',
        'invalid_grant',
        'invalid_refresh_token',
        'refresh_token_expired'
      ) then 'expired'
      else connection.status
    end,
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = now()
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.token_refresh_claim_token = p_claim_token;

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

create or replace function public.mark_social_publish_target_action_required(
  p_target_id uuid,
  p_user_id text,
  p_error_code text,
  p_error_message text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
  v_now timestamptz := now();
begin
  update public.scheduled_post_targets as target
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    last_error_message = left(nullif(trim(p_error_message), ''), 500),
    metadata = coalesce(p_metadata, target.metadata),
    next_retry_at = null,
    status = 'action_required',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.status in ('scheduling', 'scheduled', 'publishing')
  returning target.scheduled_post_id into v_post_id;

  if v_post_id is null then
    return false;
  end if;

  update public.scheduled_posts as post
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in (
            'draft',
            'scheduling',
            'scheduled',
            'publishing',
            'published'
          )
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = v_now
  where post.id = v_post_id
    and post.user_id = p_user_id
    and post.status not in ('cancelled', 'published');

  return true;
end;
$$;

create or replace function public.revoke_social_connection(
  p_connection_id uuid,
  p_user_id text,
  p_revoked_at timestamptz
)
returns setof public.social_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_ids uuid[] := '{}'::uuid[];
begin
  update public.social_connections as connection
  set
    revoked_at = p_revoked_at,
    status = 'revoked',
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = p_revoked_at
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.revoked_at is null;

  with updated_targets as (
    update public.scheduled_post_targets as target
    set
      last_error_code = 'social_connection_revoked',
      last_error_message = 'Reconnect this account before publishing this post.',
      next_retry_at = null,
      status = 'action_required',
      updated_at = p_revoked_at
    where target.social_connection_id = p_connection_id
      and target.user_id = p_user_id
      and target.status in ('draft', 'scheduling', 'scheduled', 'publishing')
    returning target.scheduled_post_id
  )
  select coalesce(array_agg(distinct scheduled_post_id), '{}'::uuid[])
  into v_post_ids
  from updated_targets;

  update public.scheduled_posts as post
  set
    last_error_code = 'social_connection_revoked',
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in (
            'draft',
            'scheduling',
            'scheduled',
            'publishing',
            'published'
          )
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = p_revoked_at
  where post.id = any(v_post_ids)
    and post.user_id = p_user_id
    and post.status not in ('cancelled', 'published');

  return query
  select connection.*
  from public.social_connections as connection
  where connection.id = p_connection_id
    and connection.user_id = p_user_id;
end;
$$;

revoke all on function public.claim_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  integer
) from public, anon, authenticated;

revoke all on function public.complete_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text[],
  text,
  text
) from public, anon, authenticated;

revoke all on function public.release_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.mark_social_publish_target_action_required(
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.revoke_social_connection(
  uuid,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.claim_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  integer
) to service_role;

grant execute on function public.complete_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text[],
  text,
  text
) to service_role;

grant execute on function public.release_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  text
) to service_role;

grant execute on function public.mark_social_publish_target_action_required(
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;

grant execute on function public.revoke_social_connection(
  uuid,
  text,
  timestamptz
) to service_role;

select pg_notify('pgrst', 'reload schema');
