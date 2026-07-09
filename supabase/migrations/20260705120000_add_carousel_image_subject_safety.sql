alter table public.category_image_assets
  add column if not exists image_subject_class text,
  add column if not exists face_count integer,
  add column if not exists person_count integer,
  add column if not exists max_face_area_ratio real,
  add column if not exists subject_analysis jsonb,
  add column if not exists subject_analyzed_at timestamptz,
  add column if not exists subject_analyzer_version text,
  add column if not exists subject_review_status text not null default 'unreviewed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_subject_class_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_subject_class_chk
      check (
        image_subject_class is null or image_subject_class in (
          'clear-face',
          'faceless-human',
          'object-only'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_subject_review_status_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_subject_review_status_chk
      check (subject_review_status in ('unreviewed', 'approved', 'rejected'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_face_count_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_face_count_chk
      check (face_count is null or face_count >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_person_count_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_person_count_chk
      check (person_count is null or person_count >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_max_face_area_ratio_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_max_face_area_ratio_chk
      check (
        max_face_area_ratio is null or
        (max_face_area_ratio >= 0 and max_face_area_ratio <= 1)
      )
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_subject_class_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_subject_review_status_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_face_count_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_person_count_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_max_face_area_ratio_chk;

create index if not exists category_image_assets_ready_subject_idx
  on public.category_image_assets (
    category_slug,
    status,
    image_subject_class,
    visual_bucket,
    usage_count,
    created_at
  );

create index if not exists category_image_assets_subject_review_idx
  on public.category_image_assets (
    category_slug,
    image_subject_class,
    subject_review_status,
    status
  );
