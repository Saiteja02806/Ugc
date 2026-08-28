-- The Trending walkthrough is education for profiles created after this release.
-- Existing profiles must not receive a newly introduced first-visit guide.
update public.business_profiles
set trending_walkthrough_completed_at = now()
where trending_walkthrough_completed_at is null;
