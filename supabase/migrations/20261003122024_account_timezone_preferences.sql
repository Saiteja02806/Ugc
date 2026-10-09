-- Account default is initialized once from the browser at first verified sign-in.
-- Existing onboarding regions are preserved, including IANA aliases.
create table public.user_timezone_preferences (
  user_id text primary key check (length(trim(user_id)) > 0),
  timezone text not null check (length(timezone) between 1 and 100),
  created_at timestamptz not null default now()
);
alter table public.user_timezone_preferences enable row level security;
revoke all on public.user_timezone_preferences from public, anon, authenticated;
grant select, insert on public.user_timezone_preferences to service_role;

insert into public.user_timezone_preferences(user_id, timezone)
select distinct on (profile.user_id) profile.user_id, profile.trending_timezone
from public.business_profiles as profile
where exists (select 1 from pg_catalog.pg_timezone_names as zone where zone.name=profile.trending_timezone)
order by profile.user_id, profile.updated_at desc;

create function public.initialize_user_timezone(p_user_id text, p_timezone text)
returns text language plpgsql security invoker set search_path = '' as $function$
begin
  if p_user_id is null or length(trim(p_user_id))=0 then
    raise exception 'user_id_required';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name=p_timezone
  ) then
    raise exception 'invalid_timezone';
  end if;
  insert into public.user_timezone_preferences(user_id, timezone)
    values (p_user_id, p_timezone) on conflict (user_id) do nothing;
  return (select timezone from public.user_timezone_preferences where user_id=p_user_id);
end;
$function$;
revoke all on function public.initialize_user_timezone(text,text) from public, anon, authenticated;
grant execute on function public.initialize_user_timezone(text,text) to service_role;
