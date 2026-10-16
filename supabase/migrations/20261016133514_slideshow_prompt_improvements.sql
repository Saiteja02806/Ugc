-- Text-only suggestions are separate from Remix Text and image-generation credits.
create table public.explore_slideshow_prompts (
  user_id text not null check (length(user_id) between 1 and 128),
  request_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  input_json jsonb not null check (jsonb_typeof(input_json) = 'object' and octet_length(input_json::text) <= 80000),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  output_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_key),
  check ((status = 'completed') = (output_json is not null)),
  check (output_json is null or jsonb_typeof(output_json) = 'object' and octet_length(output_json::text) <= 100000)
);
create index explore_slideshow_prompts_user_created on public.explore_slideshow_prompts(user_id, created_at);
alter table public.explore_slideshow_prompts enable row level security;
revoke all on public.explore_slideshow_prompts from public, anon, authenticated;
grant select, insert, update on public.explore_slideshow_prompts to service_role;

create function public.explore_claim_slideshow_prompt(p_user_id text, p_request_key uuid, p_payload_hash text, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.explore_slideshow_prompts%rowtype;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 128 or p_request_key is null
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or p_input is null then
    raise exception 'invalid_prompt_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('explore-slideshow-prompt:' || p_user_id, 0));
  select * into saved from public.explore_slideshow_prompts where user_id = p_user_id and request_key = p_request_key;
  if found then
    if saved.payload_hash <> p_payload_hash then raise exception 'prompt_request_conflict'; end if;
    return jsonb_build_object('claimed', false, 'status', saved.status, 'output', saved.output_json);
  end if;
  if (select count(*) from public.explore_slideshow_prompts where user_id = p_user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'prompt_daily_limit';
  end if;
  insert into public.explore_slideshow_prompts(user_id, request_key, payload_hash, input_json)
    values(p_user_id, p_request_key, p_payload_hash, p_input);
  return jsonb_build_object('claimed', true, 'status', 'pending', 'output', null);
end;
$$;
revoke all on function public.explore_claim_slideshow_prompt(text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.explore_claim_slideshow_prompt(text,uuid,text,jsonb) to service_role;
