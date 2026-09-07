-- Create Content is deliberately isolated from Trending assignments and plans.
-- A card owns one active text overlay for one user-owned Creative Asset.
CREATE TABLE public.create_content_cards (
  id                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id               text                     NOT NULL,
  source_media_asset_id uuid                     NOT NULL,
  active_format         text                     NOT NULL,
  active_text           text                     NOT NULL,
  text_position         jsonb                    NOT NULL DEFAULT '{"x": 0.5, "y": 0.5}'::jsonb,
  revision              integer                  NOT NULL DEFAULT 1,
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  updated_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT create_content_cards_pkey PRIMARY KEY (id),
  CONSTRAINT create_content_cards_owner_asset_key UNIQUE (user_id, source_media_asset_id),
  CONSTRAINT create_content_cards_active_format_check
    CHECK (active_format IN ('wall_text', 'hook_text')),
  CONSTRAINT create_content_cards_active_text_check
    CHECK (char_length(btrim(active_text)) BETWEEN 1 AND 600),
  CONSTRAINT create_content_cards_position_check
    CHECK (jsonb_typeof(text_position) = 'object'),
  CONSTRAINT create_content_cards_revision_check
    CHECK (revision > 0),
  CONSTRAINT create_content_cards_source_media_asset_id_fkey
    FOREIGN KEY (source_media_asset_id)
    REFERENCES public.media_assets(id)
    ON DELETE CASCADE,
  CONSTRAINT create_content_cards_user_id_check
    CHECK (char_length(btrim(user_id)) BETWEEN 1 AND 240)
);

ALTER TABLE public.create_content_cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX create_content_cards_owner_updated_idx
  ON public.create_content_cards USING btree (user_id, updated_at DESC);

-- Create Content requests use Firebase-authenticated server routes with the
-- service role. Do not expose this private work-in-progress state directly.
REVOKE ALL ON TABLE public.create_content_cards FROM anon, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.create_content_cards TO postgres, service_role;

COMMENT ON TABLE public.create_content_cards IS
  'Private, one-overlay Create Content state. It never references Trending assignments, feed slots, or content plans.';
