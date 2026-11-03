-- Merchant-confirmed monthly allowances: Starter 200, Growth 600, Startup 1200.
-- Forward correction; do not rewrite the previously applied Startup migration.
-- Existing current-period balances, usage, reservations and grant history remain
-- intact. New subscriptions/grants and subsequent monthly cycles use this policy.

create or replace function public.paid_plan_monthly_credit_limit(p_plan_key text)
returns integer language sql immutable strict set search_path = ''
as $$
  select case p_plan_key when 'starter' then 200 when 'growth' then 600
    when 'startup' then 1200 else 0 end;
$$;
revoke all on function public.paid_plan_monthly_credit_limit(text) from public, anon, authenticated;
grant execute on function public.paid_plan_monthly_credit_limit(text) to service_role;

-- Patch only reviewed assignments in the installed functions. Fail atomically
-- if they have drifted, rather than replacing unrelated production logic.
do $migration$
declare
  definition text;
  needle text;
  replacement text;
begin
  definition := pg_get_functiondef('public.apply_dodo_subscription_event(text,text,timestamptz,text,text,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,jsonb,jsonb)'::regprocedure);
  definition := replace(definition, E'\r\n', E'\n');
  needle := 'resolved_credit_limit := case p_plan_key when ''startup'' then 1800 when ''growth'' then 720 when ''starter'' then 360 else 360 end;';
  replacement := $patch$resolved_credit_limit := coalesce(
    (select existing.credit_limit from public.billing_credit_balances as existing
     where existing.user_id = p_user_id
       and existing.dodo_subscription_id = p_subscription_id
       and existing.plan_key = p_plan_key and existing.period_end > now()),
    public.paid_plan_monthly_credit_limit(p_plan_key)
  );$patch$;
  if position(needle in definition) = 0 then raise exception 'credit_policy_apply_event_drift'; end if;
  execute replace(definition, needle, replacement);

  definition := pg_get_functiondef('public.grant_complimentary_plan(text,text,text,text,timestamptz)'::regprocedure);
  definition := replace(definition, E'\r\n', E'\n');
  needle := E'v_credit_limit := case p_plan_key\n    when ''startup'' then 1800\n    when ''growth'' then 720\n    when ''starter'' then 360\n    else 0\n  end;';
  if position(needle in definition) = 0 then raise exception 'credit_policy_complimentary_grant_drift'; end if;
  execute replace(definition, needle, 'v_credit_limit := public.paid_plan_monthly_credit_limit(p_plan_key);');

  definition := pg_get_functiondef('public.normalize_billing_credit_cycle()'::regprocedure);
  definition := replace(definition, E'\r\n', E'\n');
  needle := 'if should_reset then';
  replacement := $patch$if should_reset then
    if exists (
      select 1 from public.billing_subscriptions as subscription
      where subscription.dodo_subscription_id = new.dodo_subscription_id
        and subscription.user_id = new.user_id and subscription.status = 'active'
    ) then
      -- BEFORE INSERT also runs before ON CONFLICT. Preserve an existing
      -- same-cycle balance here as well as in the webhook function.
      new.credit_limit := coalesce(
        (select existing.credit_limit from public.billing_credit_balances as existing
         where existing.user_id = new.user_id
           and existing.dodo_subscription_id = new.dodo_subscription_id
           and existing.plan_key = new.plan_key and existing.period_end > now()),
        public.paid_plan_monthly_credit_limit(new.plan_key)
      );
    end if;$patch$;
  if position(needle in definition) = 0 then raise exception 'credit_policy_monthly_cycle_drift'; end if;
  execute replace(definition, needle, replacement);

  definition := pg_get_functiondef('public.reserve_subscription_billing_credits(text,text,text,integer)'::regprocedure);
  definition := replace(definition, E'\r\n', E'\n');
  needle := E'if v_complimentary_balance.period_end <= now() then\n      update public.complimentary_plan_credit_balances\n      set\n';
  replacement := needle || $patch$        credit_limit = case
          when v_complimentary_balance.credit_limit = case v_complimentary_balance.plan_key
            when 'starter' then 360 when 'growth' then 720 when 'startup' then 1800 else -1 end
          then public.paid_plan_monthly_credit_limit(v_complimentary_balance.plan_key)
          else v_complimentary_balance.credit_limit end,
$patch$;
  if position(needle in definition) = 0 then raise exception 'credit_policy_complimentary_rollover_drift'; end if;
  execute replace(definition, needle, replacement);
end;
$migration$;

-- No balance backfill or reservation/usage rewrite. Review production function
-- definitions and apply this migration before releasing the matching app policy.
