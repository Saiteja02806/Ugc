-- Supabase's public-schema defaults grant ALL to service_role on new tables.
-- Remove those inherited table grants before retaining append-only receipts.
revoke all on table public.mcp_creative_group_requests, public.mcp_library_requests from service_role;
grant select, insert on table public.mcp_creative_group_requests, public.mcp_library_requests to service_role;
select pg_notify('pgrst', 'reload schema');
