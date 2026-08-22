-- The billing settlement function is a trigger implementation, not a public
-- RPC. Existing projects need this follow-up because PostgreSQL grants
-- EXECUTE on new functions to PUBLIC by default.
revoke all on function public.settle_billing_from_background_job()
  from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');
