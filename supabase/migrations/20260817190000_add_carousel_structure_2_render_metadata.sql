alter table public.carousel_slides
  add column if not exists structure_id text not null default 'structure_1',
  add column if not exists structure_version integer not null default 1,
  add column if not exists story_format_id text,
  add column if not exists story_role text,
  add column if not exists story_layout_variant text,
  add column if not exists story_text_treatment text,
  add column if not exists visual_role text,
  add column if not exists product_visual_eligibility text;

update public.carousel_slides as slide
set
  structure_id = generation.structure_id,
  structure_version = generation.structure_version
from public.carousel_generations as generation
where generation.id = slide.carousel_generation_id
  and (
    slide.structure_id is distinct from generation.structure_id
    or slide.structure_version is distinct from generation.structure_version
  );

create unique index if not exists carousel_generations_id_structure_version_uidx
  on public.carousel_generations (id, structure_id, structure_version);

alter table public.carousel_slides
  drop constraint if exists carousel_slides_structure_id_check,
  add constraint carousel_slides_structure_id_check
    check (structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_slides_structure_version_check,
  add constraint carousel_slides_structure_version_check
    check (structure_version >= 1),
  drop constraint if exists carousel_slides_story_format_id_check,
  add constraint carousel_slides_story_format_id_check
    check (
      story_format_id is null
      or story_format_id in (
        'wrong_belief',
        'perfect_plan_breaks',
        'stopped_behavior',
        'terrible_at',
        'result_without_sacrifice',
        'identity_transformation',
        'new_rule',
        'wrong_villain'
      )
    ),
  drop constraint if exists carousel_slides_story_role_check,
  add constraint carousel_slides_story_role_check
    check (
      story_role is null
      or story_role in (
        'recognition',
        'failure_scene',
        'reframe',
        'product_turning_point',
        'proof_reflection_cta'
      )
    ),
  drop constraint if exists carousel_slides_story_layout_variant_check,
  add constraint carousel_slides_story_layout_variant_check
    check (
      story_layout_variant is null
      or story_layout_variant in (
        'story_overlay_only',
        'story_pill_overlay',
        'story_product_reveal'
      )
    ),
  drop constraint if exists carousel_slides_story_text_treatment_check,
  add constraint carousel_slides_story_text_treatment_check
    check (
      story_text_treatment is null
      or story_text_treatment in (
        'outlined_overlay',
        'overlay',
        'pill'
      )
    ),
  drop constraint if exists carousel_slides_visual_role_check,
  add constraint carousel_slides_visual_role_check
    check (
      visual_role is null
      or visual_role in ('hook', 'human', 'static', 'product_asset')
    ),
  drop constraint if exists carousel_slides_product_visual_eligibility_check,
  add constraint carousel_slides_product_visual_eligibility_check
    check (
      product_visual_eligibility is null
      or product_visual_eligibility in ('allowed', 'forbidden', 'preferred')
    ),
  drop constraint if exists carousel_slides_structure_2_metadata_check,
  add constraint carousel_slides_structure_2_metadata_check
    check (
      (
        structure_id = 'structure_1'
        and story_format_id is null
        and story_role is null
        and story_layout_variant is null
        and story_text_treatment is null
        and visual_role is null
        and product_visual_eligibility is null
      )
      or
      (
        structure_id = 'structure_2'
        and nullif(btrim(story_format_id), '') is not null
        and story_role is not null
        and story_layout_variant is not null
        and story_text_treatment is not null
        and visual_role is not null
        and product_visual_eligibility is not null
        and (
          visual_role <> 'product_asset'
          or (
            slide_number in (4, 5)
            and product_visual_eligibility in ('allowed', 'preferred')
          )
        )
      )
    ),
  drop constraint if exists carousel_slides_generation_structure_fk,
  add constraint carousel_slides_generation_structure_fk
    foreign key (carousel_generation_id, structure_id, structure_version)
    references public.carousel_generations (id, structure_id, structure_version)
    on delete cascade;

create index if not exists carousel_slides_structure_story_format_idx
  on public.carousel_slides (
    structure_id,
    story_format_id,
    story_role,
    created_at desc
  )
  where structure_id = 'structure_2';

create or replace function public.prevent_carousel_slide_story_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version
     or new.story_format_id is distinct from old.story_format_id
     or new.story_role is distinct from old.story_role then
    raise exception 'carousel_slide_story_identity_is_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists carousel_slides_story_identity_immutable
  on public.carousel_slides;
create trigger carousel_slides_story_identity_immutable
before update on public.carousel_slides
for each row execute function
  public.prevent_carousel_slide_story_identity_change();

revoke all on function public.prevent_carousel_slide_story_identity_change()
  from public, anon, authenticated;

comment on column public.carousel_slides.story_format_id is
  'Structure 2 format identity. It is intentionally separate from every Structure 1 format namespace.';
comment on column public.carousel_slides.story_layout_variant is
  'One of the three native-story layouts selected by the Structure 2 render-spec adapter.';
comment on column public.carousel_slides.story_text_treatment is
  'Structure 2 text treatment used to reproduce and diagnose the rendered slide.';
comment on column public.carousel_slides.visual_role is
  'Reserved role from the shared 1:2:2 image library: hook, human, static, or product_asset.';

select pg_notify('pgrst', 'reload schema');
