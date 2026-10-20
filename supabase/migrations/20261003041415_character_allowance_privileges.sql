-- Supabase's default service-role grants can include mutation privileges not
-- needed by the allowance reader and one-time admission transaction.
revoke all on table public.character_free_generation_allowances from service_role;
grant select, insert on table public.character_free_generation_allowances to service_role;
