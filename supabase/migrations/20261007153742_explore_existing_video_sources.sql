-- Existing Creative Assets can contain legacy creator footage in influencer.
-- Replace only eligibility in the current RPC, retaining replay, ownership,
-- queue limits, subtitle checks and service-only grants.
do $$
declare
  definition text;
  previous_predicate text := 'collection=expected_collection';
begin
  select pg_get_functiondef('public.explore_create_video_finish(text,uuid,text,jsonb)'::regprocedure) into definition;
  if length(definition) - length(replace(definition, previous_predicate, '')) <> length(previous_predicate) then
    raise exception 'Explore sources: review the current asset eligibility before applying this migration';
  end if;
  execute replace(definition, previous_predicate,
    '((expected_collection=''video'' and collection in (''video'',''influencer'') and mime_type like ''video/%'') or (expected_collection=''audio'' and collection=''audio''))');
end;
$$;
