-- Audio references use the same owned media records and signed storage uploads.
ALTER TABLE public.media_assets DROP CONSTRAINT media_assets_collection_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_collection_check
  CHECK (collection IN ('influencer', 'video', 'image', 'audio'));
