-- Private, per-account last successful values survive error-only job history.
create table public.analytics_account_snapshots (
  user_id text not null,
  social_connection_id uuid not null references public.social_connections(id) on delete cascade,
  operation text not null check (operation in ('instagram_insights','instagram_content','tiktok_videos','youtube_channel')),
  range_days integer not null check (
    (operation in ('instagram_insights','instagram_content') and range_days in (7,30,90)) or
    (operation in ('tiktok_videos','youtube_channel') and range_days=0)
  ),
  authorization_revision text not null,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  last_success_at timestamptz,
  attempted_at timestamptz not null,
  refresh_status text not null check (refresh_status in ('ready','error','permission_missing','unavailable')),
  refresh_message text,
  primary key (user_id,social_connection_id,operation,range_days)
);
alter table public.analytics_account_snapshots enable row level security;
create index analytics_account_snapshots_connection_idx on public.analytics_account_snapshots(social_connection_id);
revoke all on public.analytics_account_snapshots from public, anon, authenticated, service_role;
grant select, insert, update on public.analytics_account_snapshots to service_role;

create function public.save_analytics_account_snapshot(
  p_user_id text, p_connection_id uuid, p_operation text, p_range_days integer,
  p_authorization_revision text, p_account jsonb, p_attempted_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare c public.social_connections; is_success boolean;
begin
  -- The row lock serializes this check/write with a concurrent reconnect.
  select * into c from public.social_connections where id=p_connection_id and user_id=p_user_id and revoked_at is null for share;
  if not found then return false; end if;
  if coalesce(c.metadata->>'authorizationRevision','') <> '' then
    if c.metadata->>'authorizationRevision' <> p_authorization_revision then return false; end if;
  elsif c.connected_at <> p_authorization_revision::timestamptz then return false;
  end if;
  if p_account->>'connectionId' is distinct from p_connection_id::text
    or jsonb_typeof(p_account) <> 'object' or pg_column_size(p_account)>2097152
    or (p_operation like 'instagram_%' and c.platform <> 'instagram')
    or (p_operation='tiktok_videos' and c.platform <> 'tiktok')
    or (p_operation='youtube_channel' and c.platform <> 'youtube') then
    raise exception 'invalid_analytics_snapshot';
  end if;
  is_success := p_account->>'status' = 'ready' and p_account->>'lastSyncedAt' is not null;
  insert into public.analytics_account_snapshots as previous (
    user_id,social_connection_id,operation,range_days,authorization_revision,
    snapshot_json,last_success_at,attempted_at,refresh_status,refresh_message
  ) values (
    p_user_id,p_connection_id,p_operation,p_range_days,p_authorization_revision,
    p_account,case when is_success then (p_account->>'lastSyncedAt')::timestamptz end,
    p_attempted_at,p_account->>'status',left(p_account->>'message',1000)
  ) on conflict (user_id,social_connection_id,operation,range_days) do update set
    authorization_revision=excluded.authorization_revision,
    snapshot_json=case when is_success or previous.authorization_revision<>excluded.authorization_revision or previous.last_success_at is null then excluded.snapshot_json else previous.snapshot_json end,
    last_success_at=case when is_success or previous.authorization_revision<>excluded.authorization_revision then excluded.last_success_at else previous.last_success_at end,
    attempted_at=excluded.attempted_at,refresh_status=excluded.refresh_status,refresh_message=excluded.refresh_message
  where excluded.attempted_at >= previous.attempted_at;
  return true;
end;
$$;
revoke all on function public.save_analytics_account_snapshot(text,uuid,text,integer,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.save_analytics_account_snapshot(text,uuid,text,integer,text,jsonb,timestamptz) to service_role;

-- Preserve existing successful account values once; future reads never depend
-- on a bounded recent-job scan. No credentials or provider requests are involved.
insert into public.analytics_account_snapshots (
  user_id,social_connection_id,operation,range_days,authorization_revision,
  snapshot_json,last_success_at,attempted_at,refresh_status,refresh_message
)
select distinct on (j.user_id,c.id,j.input_json->>'operation',candidate.range_days)
  j.user_id,c.id,j.input_json->>'operation',candidate.range_days,
  coalesce(c.metadata->>'authorizationRevision',c.connected_at::text),a,
  candidate.synced_at,j.created_at,'ready',a->>'message'
from public.background_jobs j
cross join lateral jsonb_array_elements(case when jsonb_typeof(j.output_json->'accounts')='array' then j.output_json->'accounts' else '[]'::jsonb end) a
cross join lateral (select
  case when pg_input_is_valid(a->>'lastSyncedAt','timestamp with time zone') then (a->>'lastSyncedAt')::timestamptz end as synced_at,
  case when j.input_json->>'days' in ('7','30','90') then (j.input_json->>'days')::integer else 0 end as range_days
) candidate
join public.social_connections c on c.user_id=j.user_id and c.id::text=a->>'connectionId' and c.revoked_at is null
where j.job_type='analytics_sync' and j.status='completed' and a->>'status'='ready'
  and candidate.synced_at >= c.connected_at
  and c.metadata->>'authorizationRevision' is null
  and ((j.input_json->>'operation' in ('instagram_insights','instagram_content') and j.input_json->>'days' in ('7','30','90') and c.platform='instagram')
    or (j.input_json->>'operation'='tiktok_videos' and c.platform='tiktok')
    or (j.input_json->>'operation'='youtube_channel' and c.platform='youtube'))
order by j.user_id,c.id,j.input_json->>'operation',candidate.range_days,j.created_at desc
on conflict do nothing;
