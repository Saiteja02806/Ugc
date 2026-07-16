begin;

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
    and (
      connection.refresh_token_ciphertext is not null
      or connection.platform = 'instagram'
    )
    and (
      connection.token_refresh_claim_token is null
      or connection.token_refresh_claimed_at <
        v_now - make_interval(secs => v_stale_after_seconds)
      or connection.token_refresh_claim_token = p_claim_token
    )
  returning connection.*;
end;
$$;

revoke all on function public.claim_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  integer
) from public, anon, authenticated;
grant execute on function public.claim_social_connection_token_refresh(
  uuid,
  text,
  uuid,
  integer
) to service_role;

commit;
