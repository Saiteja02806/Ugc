-- Wall-of-Text early delivery is now the standard plan lifecycle for every account.
-- Do not rewrite an already-created plan: a running legacy planner must complete
-- under the contract it started with. New plans receive the fast path at insert.

insert into public.wall_text_early_delivery_accounts (user_id, enabled)
select distinct user_id, true
from public.business_profiles
on conflict (user_id) do update
  set enabled = true,
      updated_at = now();

create or replace function public.initialize_wall_text_early_delivery()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Keep the rollout table populated for its recovery and publication queries,
  -- while making early delivery unconditional for every newly-created plan.
  insert into public.wall_text_early_delivery_accounts (user_id, enabled)
  values (new.user_id, true)
  on conflict (user_id) do update
    set enabled = true,
        updated_at = now();

  new.early_delivery_enabled := true;
  return new;
end;
$$;
