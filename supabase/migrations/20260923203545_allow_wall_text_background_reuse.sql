-- Wall-of-text generation deliberately rotates completed backgrounds after the
-- fresh inventory is exhausted. Candidate identity remains unique, while an
-- overlay asset may be reused by a later completed creative.
ALTER TABLE public.wall_text_creatives
  DROP CONSTRAINT IF EXISTS wall_text_creatives_profile_asset_key;
