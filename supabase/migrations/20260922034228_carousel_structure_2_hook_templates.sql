-- Additive, service-role-only preparation state. Historical output is untouched.
-- Both structures share optional hook metadata. Keep the established pair
-- invariant while removing the old Structure-1-only restriction.
alter table public.carousel_experiment_assignments
  drop constraint carousel_experiment_assignments_hook_template_pair_check,
  add constraint carousel_experiment_assignments_hook_template_pair_check check (
    (hook_template_id is null and hook_template_version is null) or
    (hook_template_id is not null and hook_template_version is not null
      and structure_id in ('structure_1','structure_2')
      and hook_template_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and hook_template_version >= 1)
  );
alter table public.carousel_generations
  drop constraint carousel_generations_hook_template_pair_check,
  add constraint carousel_generations_hook_template_pair_check check (
    (hook_template_id is null and hook_template_version is null) or
    (hook_template_id is not null and hook_template_version is not null
      and structure_id in ('structure_1','structure_2')
      and hook_template_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and hook_template_version >= 1)
  );

alter table public.carousel_experiment_batches
  add column hook_template_mode_snapshot text check (hook_template_mode_snapshot in ('off','shadow','enabled')),
  add column structure_2_hook_templates_resolved_at timestamptz,
  add column structure_2_hook_template_diagnostics jsonb;

create function public.snapshot_carousel_hook_template_mode(p_batch_id uuid, p_mode text)
returns text language plpgsql security invoker set search_path = '' as $$
declare b public.carousel_experiment_batches%rowtype;
begin
  if p_mode is null or p_mode not in ('off','shadow','enabled') then raise exception 'invalid_hook_mode'; end if;
  select * into strict b from public.carousel_experiment_batches where id=p_batch_id for update;
  if b.hook_template_mode_snapshot is not null then return b.hook_template_mode_snapshot; end if;
  -- Never enable an already-dispatched legacy batch by replaying preparation.
  if b.planner_job_id is not null or b.status <> 'reserved' then p_mode := 'off'; end if;
  update public.carousel_experiment_batches set hook_template_mode_snapshot=p_mode where id=p_batch_id;
  return p_mode;
end $$;
revoke all on function public.snapshot_carousel_hook_template_mode(uuid,text) from public,anon,authenticated;
grant execute on function public.snapshot_carousel_hook_template_mode(uuid,text) to service_role;

create function public.resolve_carousel_structure_2_hooks(p_batch_id uuid, p_mode text, p_choices jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b public.carousel_experiment_batches%rowtype; n integer;
begin
  select * into strict b from public.carousel_experiment_batches where id=p_batch_id for update;
  if b.structure_id <> 'structure_2' then raise exception 'hook_resolution_requires_structure_2'; end if;
  if b.structure_2_hook_templates_resolved_at is not null then return b.structure_2_hook_template_diagnostics; end if;
  if p_mode is distinct from coalesce(b.hook_template_mode_snapshot,'off') then raise exception 'hook_mode_mismatch'; end if;
  if b.status not in ('processing','queued','reserved') then raise exception 'hook_batch_not_active'; end if;
  if jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) <> 5 then raise exception 'hook_choices_require_five_slots'; end if;
  if (select count(distinct c.slot_index) from jsonb_to_recordset(p_choices) as c(slot_index integer)) <> 5 then raise exception 'duplicate_hook_slots'; end if;
  -- Fence concurrent output persistence as well as competing resolvers.
  perform 1 from public.carousel_experiment_assignments where experiment_batch_id=b.id order by slot_index for update;
  perform 1 from public.carousel_generations where carousel_experiment_batch_id=b.id order by id for update;
  select count(*) into n from jsonb_to_recordset(p_choices) as c(slot_index integer, story_format_id text, hook_template_id text, hook_template_version integer)
  join public.carousel_experiment_assignments a on a.experiment_batch_id=b.id and a.slot_index=c.slot_index
  join public.carousel_generations g on g.id=a.carousel_generation_id and g.carousel_experiment_assignment_id=a.id
  join public.business_profiles p on p.id=b.business_profile_id
  where a.structure_id='structure_2' and g.structure_id='structure_2'
    and c.story_format_id=coalesce(a.actual_format_id,a.assigned_format_id)
    and c.story_format_id=coalesce(g.content_format_id,g.content_assigned_format_id)
    and g.carousel_experiment_batch_id=b.id and g.generation_batch_id=b.generation_batch_id
    and g.business_profile_id=b.business_profile_id and g.business_profile_version=b.business_profile_version
    and p.profile_version=b.business_profile_version
    and g.user_id=p.user_id and g.status='processing'
    and g.content_plan_normalized is null
    and ((c.hook_template_id is null and c.hook_template_version is null)
      or (p_mode='enabled' and c.hook_template_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and c.hook_template_version>=1));
  if n <> 5 or exists (select 1 from public.carousel_slides s join public.carousel_generations g on g.id=s.carousel_generation_id where g.carousel_experiment_batch_id=b.id) then
    raise exception 'hook_batch_identity_or_output_mismatch';
  end if;
  update public.carousel_experiment_assignments a set hook_template_id=c.hook_template_id, hook_template_version=c.hook_template_version
  from jsonb_to_recordset(p_choices) as c(slot_index integer, hook_template_id text, hook_template_version integer)
  where a.experiment_batch_id=b.id and a.slot_index=c.slot_index;
  update public.carousel_generations g set hook_template_id=a.hook_template_id,hook_template_version=a.hook_template_version
  from public.carousel_experiment_assignments a where a.experiment_batch_id=b.id and g.id=a.carousel_generation_id;
  update public.carousel_experiment_batches set structure_2_hook_templates_resolved_at=now(),
    structure_2_hook_template_diagnostics=p_choices where id=b.id;
  return p_choices;
end $$;
revoke all on function public.resolve_carousel_structure_2_hooks(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_carousel_structure_2_hooks(uuid,text,jsonb) to service_role;

comment on column public.carousel_experiment_assignments.hook_template_id is 'Effective optional Slide 1 template for either structure; null for off/shadow, legacy or native-hook fallback.';
comment on column public.carousel_generations.hook_template_id is 'Effective optional Slide 1 template for either structure. Structure 2 selection resolves after its final story format is known.';

select pg_notify('pgrst', 'reload schema');
