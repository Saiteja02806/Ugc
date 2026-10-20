begin;
do $test$
declare
  v_user text := 'timezone-regression-' || gen_random_uuid();
  v_other text := 'timezone-regression-' || gen_random_uuid();
begin
  if public.initialize_user_timezone(v_user, 'America/New_York') <> 'America/New_York' then
    raise exception 'Browser region was not initialized';
  end if;
  if public.initialize_user_timezone(v_user, 'Asia/Kolkata') <> 'America/New_York' then
    raise exception 'Later login replaced the signup region';
  end if;
  if public.initialize_user_timezone(v_other, 'Asia/Kathmandu') <> 'Asia/Kathmandu' then
    raise exception 'Another owner inherited the first owner timezone';
  end if;
  begin
    perform public.initialize_user_timezone(v_other, 'invalid/zone');
    raise exception 'Invalid zone was accepted';
  exception when others then
    if sqlerrm <> 'invalid_timezone' then raise; end if;
  end;
  if has_table_privilege('anon', 'public.user_timezone_preferences', 'SELECT')
    or has_table_privilege('authenticated', 'public.user_timezone_preferences', 'SELECT')
    or has_function_privilege('anon', 'public.initialize_user_timezone(text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.initialize_user_timezone(text,text)', 'EXECUTE') then
    raise exception 'Preference access escaped the verified server boundary';
  end if;
end;
$test$;
rollback;
