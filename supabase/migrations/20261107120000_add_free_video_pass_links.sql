-- Single-use free video generation links (vidmake.io/freevideo).
-- Regular free accounts remain at 0 credits; only an account that claims a
-- single-use link receives 1 generation pass across Hook, Wall-of-Text, or
-- Slideshow (Talking Head is excluded).

alter table public.free_generation_credit_balances
  drop constraint if exists free_generation_credit_balances_credit_limit_check;

alter table public.free_generation_credit_balances
  alter column credit_limit set default 0;

alter table public.free_generation_credit_balances
  add constraint free_generation_credit_balances_credit_limit_check
  check (credit_limit >= 0);

create table if not exists public.free_video_pass_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) >= 12),
  label text,
  created_by_user_id text not null check (length(btrim(created_by_user_id)) > 0),
  claimed_by_user_id text unique check (claimed_by_user_id is null or length(btrim(claimed_by_user_id)) > 0),
  claimed_at timestamptz,
  pass_status text not null default 'unclaimed'
    check (pass_status in ('unclaimed', 'available', 'reserved', 'used', 'revoked')),
  reserved_generation_key text,
  reserved_format text
    check (reserved_format is null or reserved_format in ('hook', 'wall_text', 'slideshow')),
  reserved_units integer not null default 0 check (reserved_units >= 0 and reserved_units <= 12),
  completed_units integer not null default 0 check (completed_units >= 0),
  keyframe_attempts_used integer not null default 0 check (keyframe_attempts_used >= 0 and keyframe_attempts_used <= 3),
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint free_video_pass_links_claim_consistency_check check (
    (pass_status = 'unclaimed' and claimed_by_user_id is null)
    or (pass_status in ('available', 'reserved', 'used') and claimed_by_user_id is not null)
    or pass_status = 'revoked'
  )
);

create index if not exists free_video_pass_links_claimed_by_user_idx
  on public.free_video_pass_links (claimed_by_user_id)
  where claimed_by_user_id is not null;

create index if not exists free_video_pass_links_created_at_idx
  on public.free_video_pass_links (created_at desc);

alter table public.free_video_pass_links enable row level security;
revoke all on table public.free_video_pass_links from public, anon, authenticated;
grant select, insert, update on table public.free_video_pass_links to service_role;

create or replace function public.claim_free_video_pass_link(
  p_code text,
  p_user_id text
)
returns public.free_video_pass_links
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_code text := pg_catalog.btrim(coalesce(p_code, ''));
  v_user_id text := pg_catalog.btrim(coalesce(p_user_id, ''));
  v_link public.free_video_pass_links;
  v_existing_user_link public.free_video_pass_links;
  v_now timestamptz := now();
begin
  if v_code = '' or v_user_id = '' then
    raise exception 'invalid_free_video_pass_claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('free-video-pass-user:' || v_user_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('free-video-pass-code:' || v_code, 0)
  );

  select * into v_link
  from public.free_video_pass_links
  where code = v_code
  for update;

  if not found then
    raise exception 'free_video_pass_not_found';
  end if;

  if v_link.pass_status = 'revoked' then
    raise exception 'free_video_pass_revoked';
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= v_now and v_link.claimed_by_user_id is null then
    raise exception 'free_video_pass_expired';
  end if;

  if v_link.claimed_by_user_id is not null then
    if v_link.claimed_by_user_id = v_user_id then
      return v_link;
    end if;
    raise exception 'free_video_pass_already_claimed';
  end if;

  select * into v_existing_user_link
  from public.free_video_pass_links
  where claimed_by_user_id = v_user_id
  for update;

  if found then
    raise exception 'free_video_pass_user_already_has_pass';
  end if;

  update public.free_video_pass_links
  set
    claimed_by_user_id = v_user_id,
    claimed_at = v_now,
    pass_status = 'available',
    updated_at = v_now
  where id = v_link.id
  returning * into v_link;

  insert into public.free_generation_credit_balances (user_id, credit_limit)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  return v_link;
end;
$function$;

revoke all on function public.claim_free_video_pass_link(text, text) from public, anon, authenticated;
grant execute on function public.claim_free_video_pass_link(text, text) to service_role;

create or replace function public.settle_billing_credit_reservation(
  p_user_id text,
  p_idempotency_key text,
  p_background_job_id uuid,
  p_commit boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_reservation public.billing_credit_reservations;
  v_link public.free_video_pass_links;
  v_now timestamptz := now();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0));
  select * into v_reservation from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if not found or not v_reservation.uses_free_generation_credits then
    return public.settle_subscription_billing_credit_reservation(
      p_user_id, p_idempotency_key, p_background_job_id, p_commit
    );
  end if;
  if v_reservation.status <> 'reserved' then return false; end if;

  update public.billing_credit_reservations set
    status = case when p_commit then 'committed' else 'released' end,
    background_job_id = coalesce(p_background_job_id, background_job_id),
    settled_at = v_now,
    updated_at = v_now
  where id = v_reservation.id;

  update public.free_generation_credit_balances set
    reserved_credits = reserved_credits - v_reservation.amount,
    used_credits = used_credits + case when p_commit then v_reservation.amount else 0 end,
    credit_limit = case
      when p_commit then credit_limit
      else greatest(used_credits + reserved_credits - v_reservation.amount, 0)
    end,
    updated_at = v_now
  where user_id = p_user_id;

  select * into v_link
  from public.free_video_pass_links
  where claimed_by_user_id = p_user_id
    and pass_status in ('reserved', 'used')
    and reserved_generation_key is not null
    and (
      p_idempotency_key = reserved_generation_key
      or p_idempotency_key like reserved_generation_key || ':%'
    )
  for update;

  if found then
    if p_commit then
      update public.free_video_pass_links
      set
        completed_units = completed_units + 1,
        pass_status = 'used',
        used_at = coalesce(used_at, v_now),
        updated_at = v_now
      where id = v_link.id;
    else
      if v_link.completed_units = 0 and greatest(v_link.reserved_units - 1, 0) = 0 then
        update public.free_video_pass_links
        set
          reserved_units = 0,
          reserved_generation_key = null,
          reserved_format = null,
          pass_status = 'available',
          updated_at = v_now
        where id = v_link.id;
      else
        update public.free_video_pass_links
        set
          reserved_units = greatest(reserved_units - 1, 0),
          updated_at = v_now
        where id = v_link.id;
      end if;
    end if;
  end if;

  return true;
end;
$function$;

revoke all on function public.settle_billing_credit_reservation(text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.settle_billing_credit_reservation(text, text, uuid, boolean) to service_role;

select pg_notify('pgrst', 'reload schema');
