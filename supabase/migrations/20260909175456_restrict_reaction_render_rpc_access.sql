-- Supabase can grant anon/authenticated EXECUTE directly through default
-- privileges. Revoking PUBLIC alone does not remove those inherited defaults.
revoke all on function public.create_reaction_generation_render_jobs_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_reaction_generation_item_render_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_reaction_generation_item_render_v2(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.fail_reaction_generation_item_render_v2(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.complete_reaction_generation_run_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_reaction_generation_render_jobs_v1(uuid,uuid,text) to service_role;
grant execute on function public.claim_reaction_generation_item_render_v1(uuid,uuid,uuid,text) to service_role;
grant execute on function public.complete_reaction_generation_item_render_v2(uuid,uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.fail_reaction_generation_item_render_v2(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.complete_reaction_generation_run_v1(uuid,uuid,text) to service_role;
