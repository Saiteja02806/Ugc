-- Settings edits are deliberately staged. The active context_json remains the
-- immutable source for already-reserved work until the owner explicitly
-- applies a reviewed draft and creates the next profile version.

alter table public.business_profiles
  add column if not exists business_context_draft_json jsonb,
  add column if not exists business_context_draft_base_version integer,
  add column if not exists business_context_draft_source text,
  add column if not exists business_context_draft_updated_at timestamptz;

alter table public.business_profiles
  drop constraint if exists business_profiles_context_draft_pair_chk;
alter table public.business_profiles
  add constraint business_profiles_context_draft_pair_chk check (
    (business_context_draft_json is null and business_context_draft_base_version is null)
    or
    (business_context_draft_json is not null and business_context_draft_base_version is not null and business_context_draft_base_version >= 1)
  );

comment on column public.business_profiles.business_context_draft_json is
  'Owner-editable, unapplied Business Context. It must never be used by creative workers.';
comment on column public.business_profiles.business_context_draft_base_version is
  'Active profile version the draft was reviewed against; mismatch requires re-review.';

select pg_notify('pgrst', 'reload schema');
