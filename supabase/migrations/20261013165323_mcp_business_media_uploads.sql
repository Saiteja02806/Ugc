-- Dedicated logo reservations; no gate, bucket or IAM change.
create table public.mcp_business_logo_uploads (
  id uuid primary key default gen_random_uuid(), user_id text not null, request_id uuid not null,
  input_json jsonb not null check(jsonb_typeof(input_json)='object'),
  storage_key text not null unique, status text not null default 'uploading' check(status in ('uploading','ready')),
  verified_logo jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  unique(user_id,request_id),
  check(status<>'ready' or jsonb_typeof(verified_logo)='object')
);
alter table public.mcp_business_logo_uploads enable row level security;
revoke all on public.mcp_business_logo_uploads from public,anon,authenticated,service_role;
grant select,insert,update on public.mcp_business_logo_uploads to service_role;
create index mcp_business_logo_uploads_history_idx on public.mcp_business_logo_uploads(user_id,created_at desc,id desc);

create function public.mcp_reserve_business_logo(p_user_id text,p_request_id uuid,p_input jsonb,p_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mcp_business_logo_uploads%rowtype; extension text;
begin
  if nullif(btrim(p_user_id),'') is null or p_request_id is null or jsonb_typeof(p_input) is distinct from 'object'
    or coalesce(p_input->>'mime_type','') not in ('image/png','image/jpeg','image/webp')
    or coalesce((p_input->>'file_size_bytes')::bigint,0) not between 1 and 2097152
    or coalesce(p_input->>'sha256','') !~ '^[a-f0-9]{64}$'
    or length(coalesce(p_input->>'file_name','')) not between 1 and 255
    or p_input->>'file_name' ~ '[/\\]' then raise exception 'mcp_logo_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-business-logo:'||p_user_id,0));
  select * into r from public.mcp_business_logo_uploads where user_id=p_user_id and request_id=p_request_id;
  if r.id is not null then
    if r.input_json is distinct from p_input then raise exception 'mcp_logo_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'upload',to_jsonb(r));
  end if;
  extension:=case p_input->>'mime_type' when 'image/png' then 'png' when 'image/webp' then 'webp' else 'jpg' end;
  if nullif(p_key,'') is null or p_key !~ ('^business-profile-logos/'||encode(sha256(convert_to(p_user_id,'UTF8')),'hex')||'/[a-f0-9-]+\.'||extension||'$') then
    raise exception 'mcp_logo_invalid'; end if;
  if (select count(*) from public.mcp_business_logo_uploads where user_id=p_user_id and status='uploading'
    and created_at>now()-interval '24 hours')>=20 then raise exception 'mcp_logo_quota'; end if;
  insert into public.mcp_business_logo_uploads(user_id,request_id,input_json,storage_key)
    values(p_user_id,p_request_id,p_input,p_key) returning * into r;
  return jsonb_build_object('replayed',false,'upload',to_jsonb(r));
end; $$;
revoke all on function public.mcp_reserve_business_logo(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.mcp_reserve_business_logo(text,uuid,jsonb,text) to service_role;

create function public.mcp_lease_business_logo(p_user_id text,p_upload_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mcp_business_logo_uploads%rowtype;
begin
  select * into r from public.mcp_business_logo_uploads where id=p_upload_id and user_id=p_user_id for update;
  if r.id is null then raise exception 'mcp_logo_not_found'; end if;
  if r.status<>'uploading' then raise exception 'mcp_logo_ready'; end if;
  if r.created_at<now()-interval '24 hours' then raise exception 'mcp_logo_expired'; end if;
  update public.mcp_business_logo_uploads set expires_at=now()+interval '10 minutes',updated_at=now()
    where id=r.id returning * into r;
  return to_jsonb(r);
end; $$;
revoke all on function public.mcp_lease_business_logo(text,uuid) from public,anon,authenticated;
grant execute on function public.mcp_lease_business_logo(text,uuid) to service_role;

create function public.mcp_confirm_business_logo(p_user_id text,p_upload_id uuid,p_logo jsonb,p_sha256 text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mcp_business_logo_uploads%rowtype;
begin
  select * into r from public.mcp_business_logo_uploads where id=p_upload_id and user_id=p_user_id for update;
  if r.id is null then raise exception 'mcp_logo_not_found'; end if;
  if r.status='ready' then return to_jsonb(r); end if;
  if jsonb_typeof(p_logo) is distinct from 'object' or p_logo->>'storageKey' is distinct from r.storage_key
    or p_logo->>'mimeType' is distinct from r.input_json->>'mime_type'
    or (p_logo->>'fileSizeBytes')::bigint is distinct from (r.input_json->>'file_size_bytes')::bigint
    or p_sha256 is distinct from r.input_json->>'sha256'
    or coalesce((p_logo->>'width')::integer,0) not between 64 and 4096
    or coalesce((p_logo->>'height')::integer,0) not between 64 and 4096
    or coalesce(p_logo->>'url','') !~ '^https://' then raise exception 'mcp_logo_mismatch'; end if;
  update public.mcp_business_logo_uploads set status='ready',verified_logo=p_logo,updated_at=now()
    where id=r.id returning * into r;
  return to_jsonb(r);
end; $$;
revoke all on function public.mcp_confirm_business_logo(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.mcp_confirm_business_logo(text,uuid,jsonb,text) to service_role;

create function public.guard_mcp_business_logo_upload_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if row(new.id,new.user_id,new.request_id,new.input_json,new.storage_key,new.created_at)
    is distinct from row(old.id,old.user_id,old.request_id,old.input_json,old.storage_key,old.created_at)
    or old.status='ready' and row(new.status,new.verified_logo,new.expires_at,new.updated_at)
      is distinct from row(old.status,old.verified_logo,old.expires_at,old.updated_at) then
    raise exception 'mcp_logo_immutable';
  end if;
  return new;
end; $$;
revoke all on function public.guard_mcp_business_logo_upload_v1() from public,anon,authenticated;
grant execute on function public.guard_mcp_business_logo_upload_v1() to service_role;
create trigger guard_mcp_business_logo_upload before update on public.mcp_business_logo_uploads
for each row execute function public.guard_mcp_business_logo_upload_v1();

-- Website and MCP identity writers both require completed verification for a
-- key issued through the dedicated MCP reservation. Older website keys retain
-- their existing inspected-key flow. No old media rows are migrated.
create function public.guard_mcp_reserved_business_logo_attachment_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare key text; expected jsonb; owner text; r public.mcp_business_logo_uploads%rowtype;
begin
  owner:=to_jsonb(new)->>'user_id';
  if tg_table_name='business_profiles' then
    key:=to_jsonb(new)->>'logo_storage_key';
    if key is null then return new; end if;
    expected:=jsonb_build_object('storageKey',key,'url',to_jsonb(new)->>'logo_url',
      'mimeType',to_jsonb(new)->>'logo_mime_type','fileSizeBytes',(to_jsonb(new)->>'logo_file_size_bytes')::bigint,
      'width',(to_jsonb(new)->>'logo_width')::integer,'height',(to_jsonb(new)->>'logo_height')::integer);
  else
    expected:=to_jsonb(new)->'logo';key:=expected->>'storageKey';
    if key is null then return new; end if;
  end if;
  select * into r from public.mcp_business_logo_uploads where storage_key=key;
  if r.id is not null and (r.user_id is distinct from owner or r.status<>'ready' or r.verified_logo is distinct from expected) then
    raise exception 'mcp_logo_attachment_not_verified';
  end if;
  return new;
end; $$;
revoke all on function public.guard_mcp_reserved_business_logo_attachment_v1() from public,anon,authenticated;
grant execute on function public.guard_mcp_reserved_business_logo_attachment_v1() to service_role;
create trigger guard_mcp_reserved_business_logo_profile before insert or update of logo_storage_key,logo_url,logo_mime_type,logo_file_size_bytes,logo_width,logo_height
on public.business_profiles for each row execute function public.guard_mcp_reserved_business_logo_attachment_v1();
create trigger guard_mcp_reserved_business_logo_draft before insert or update of logo
on public.business_onboarding_drafts for each row execute function public.guard_mcp_reserved_business_logo_attachment_v1();
