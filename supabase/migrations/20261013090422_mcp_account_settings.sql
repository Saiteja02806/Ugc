-- Service-only, account-owned settings writes and immutable accepted receipts.
-- No schedule/post, business context, billing, or provider operation is changed.
create table public.mcp_account_settings_requests (
  user_id text not null check (length(btrim(user_id)) > 0),
  request_id uuid not null,
  operation text not null check (operation in ('publishing_preferences','initialize_timezone')),
  input_json jsonb not null check (jsonb_typeof(input_json)='object'),
  result_json jsonb not null check (jsonb_typeof(result_json)='object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_id)
);
alter table public.mcp_account_settings_requests enable row level security;
-- Revoke implicit Supabase default ALL grants as well as browser access.
revoke all on public.mcp_account_settings_requests from public,anon,authenticated,service_role;
grant select,insert on public.mcp_account_settings_requests to service_role;
create index mcp_account_settings_requests_page_idx on public.mcp_account_settings_requests(user_id,created_at desc,request_id desc);

create function public.mcp_account_settings_revision(p_owner text,p_kind text,p_record jsonb)
returns text language sql immutable security invoker set search_path='' as $f$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('owner',p_owner,'kind',p_kind,'record',p_record)::text,'UTF8')),'hex');
$f$;

create function public.mcp_read_account_settings(p_user_id text)
returns jsonb language sql stable security invoker set search_path='' as $f$
  with records as (
    select (select to_jsonb(p) from public.user_publishing_preferences p where p.user_id=p_user_id) prefs,
      (select to_jsonb(t) from public.user_timezone_preferences t where t.user_id=p_user_id) tz
  ) select jsonb_build_object(
    'publishing_revision',public.mcp_account_settings_revision(p_user_id,'publishing',prefs),
    'timezone_revision',public.mcp_account_settings_revision(p_user_id,'timezone',tz),
    'publishing_preferences_saved',prefs is not null,
    'timezone_initialized',tz is not null,'timezone',tz->>'timezone',
    'publishing_preferences',jsonb_build_object(
      'containsSyntheticMedia',coalesce((prefs->>'contains_synthetic_media')::boolean,true),
      'tiktokPrivacyLevel',coalesce(prefs->>'tiktok_privacy_level','PUBLIC_TO_EVERYONE'),
      'tiktokAllowComments',coalesce((prefs->>'tiktok_allow_comments')::boolean,true),
      'youtubePrivacyStatus',coalesce(prefs->>'youtube_privacy_status','public'),
      'youtubeMadeForKids',coalesce((prefs->>'youtube_made_for_kids')::boolean,false),
      'youtubeNotifySubscribers',coalesce((prefs->>'youtube_notify_subscribers')::boolean,false)))
    from records where p_user_id is not null and length(btrim(p_user_id))>0;
$f$;

create function public.mcp_mutate_account_settings(p_user_id text,p_request_id uuid,p_operation text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $f$
declare prior public.mcp_account_settings_requests; current_revision text; row_json jsonb;
  inserted_owner text; patch jsonb; key text; accepted jsonb; state jsonb; initialized boolean:=false;
begin
  if p_user_id is null or length(btrim(p_user_id))=0 or p_request_id is null or p_operation is null
    or p_operation not in ('publishing_preferences','initialize_timezone') or p_input is null
    or jsonb_typeof(p_input) is distinct from 'object' or pg_column_size(p_input)>4096 then raise exception 'invalid_settings_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-settings-request:'||p_user_id||':'||p_request_id::text,0));
  select * into prior from public.mcp_account_settings_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if prior.operation is distinct from p_operation or prior.input_json is distinct from p_input then raise exception 'settings_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'receipt',prior.result_json);
  end if;
  if jsonb_typeof(p_input->'expected_revision') is distinct from 'string'
    or (p_input->>'expected_revision') !~ '^[a-f0-9]{64}$' then raise exception 'invalid_settings_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-settings-owner:'||p_user_id,0));
  if p_operation='publishing_preferences' then
    if not (p_input ?& array['expected_revision','preferences']) or (p_input-array['expected_revision','preferences'])<>'{}'::jsonb
      or jsonb_typeof(p_input->'preferences') is distinct from 'object' or p_input->'preferences'='{}'::jsonb then raise exception 'invalid_settings_request'; end if;
    patch:=p_input->'preferences';
    for key in select jsonb_object_keys(patch) loop
      if key in ('containsSyntheticMedia','tiktokAllowComments','youtubeMadeForKids','youtubeNotifySubscribers') then
        if jsonb_typeof(patch->key) is distinct from 'boolean' then raise exception 'invalid_settings_request'; end if;
      elsif key='tiktokPrivacyLevel' then
        if jsonb_typeof(patch->key) is distinct from 'string' or patch->>key not in ('PUBLIC_TO_EVERYONE','SELF_ONLY','FOLLOWER_OF_CREATOR','MUTUAL_FOLLOW_FRIENDS') then raise exception 'invalid_settings_request'; end if;
      elsif key='youtubePrivacyStatus' then
        if jsonb_typeof(patch->key) is distinct from 'string' or patch->>key not in ('public','private','unlisted') then raise exception 'invalid_settings_request'; end if;
      else raise exception 'invalid_settings_request'; end if;
    end loop;
    select to_jsonb(p) into row_json from public.user_publishing_preferences p where user_id=p_user_id for update;
    if not found then
      -- A concurrent website first-save can win this unique insert. Lock and
      -- re-read its real revision; never overwrite it using an absent-row token.
      insert into public.user_publishing_preferences(user_id) values(p_user_id) on conflict(user_id) do nothing returning user_id into inserted_owner;
      if inserted_owner is null then
        select to_jsonb(p) into row_json from public.user_publishing_preferences p where user_id=p_user_id for update;
      else row_json:=null; end if;
    end if;
    current_revision:=public.mcp_account_settings_revision(p_user_id,'publishing',row_json);
    if current_revision is distinct from p_input->>'expected_revision' then raise exception 'settings_revision_conflict'; end if;
    update public.user_publishing_preferences set
      contains_synthetic_media=case when patch?'containsSyntheticMedia' then (patch->>'containsSyntheticMedia')::boolean else contains_synthetic_media end,
      tiktok_privacy_level=case when patch?'tiktokPrivacyLevel' then patch->>'tiktokPrivacyLevel' else tiktok_privacy_level end,
      tiktok_allow_comments=case when patch?'tiktokAllowComments' then (patch->>'tiktokAllowComments')::boolean else tiktok_allow_comments end,
      youtube_privacy_status=case when patch?'youtubePrivacyStatus' then patch->>'youtubePrivacyStatus' else youtube_privacy_status end,
      youtube_made_for_kids=case when patch?'youtubeMadeForKids' then (patch->>'youtubeMadeForKids')::boolean else youtube_made_for_kids end,
      youtube_notify_subscribers=case when patch?'youtubeNotifySubscribers' then (patch->>'youtubeNotifySubscribers')::boolean else youtube_notify_subscribers end,
      updated_at=clock_timestamp() where user_id=p_user_id;
  else
    if not (p_input ?& array['expected_revision','timezone']) or (p_input-array['expected_revision','timezone'])<>'{}'::jsonb
      or jsonb_typeof(p_input->'timezone') is distinct from 'string' or length(p_input->>'timezone') not between 1 and 100
      or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_input->>'timezone') then raise exception 'invalid_settings_request'; end if;
    select to_jsonb(t) into row_json from public.user_timezone_preferences t where user_id=p_user_id for update;
    current_revision:=public.mcp_account_settings_revision(p_user_id,'timezone',row_json);
    if current_revision is distinct from p_input->>'expected_revision' then raise exception 'settings_revision_conflict'; end if;
    if row_json is null then
      insert into public.user_timezone_preferences(user_id,timezone) values(p_user_id,p_input->>'timezone')
        on conflict(user_id) do nothing returning user_id into inserted_owner;
      if inserted_owner is null then raise exception 'settings_revision_conflict'; end if;
      initialized:=true;
    end if;
    -- Website policy: an initialized timezone is preserved, not replaced.
  end if;
  state:=public.mcp_read_account_settings(p_user_id);
  accepted:=jsonb_build_object('request_id',p_request_id,'operation',p_operation,'initialized',initialized,'state',state);
  insert into public.mcp_account_settings_requests(user_id,request_id,operation,input_json,result_json)
    values(p_user_id,p_request_id,p_operation,p_input,accepted);
  return jsonb_build_object('replayed',false,'receipt',accepted);
end;
$f$;
revoke all on function public.mcp_account_settings_revision(text,text,jsonb),public.mcp_read_account_settings(text),
  public.mcp_mutate_account_settings(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_account_settings_revision(text,text,jsonb),public.mcp_read_account_settings(text),
  public.mcp_mutate_account_settings(text,uuid,text,jsonb) to service_role;
select pg_notify('pgrst','reload schema');
