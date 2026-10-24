-- Add ReAPI without rewriting existing operations, fingerprints, RLS or grants.
ALTER TABLE public.generation_provider_operations
  DROP CONSTRAINT generation_provider_operations_provider_check,
  ADD CONSTRAINT generation_provider_operations_provider_check
  CHECK (provider = ANY (ARRAY['gemini', 'higgsfield', 'openai', 'openrouter', 'reapi', 'runway', 'veo']));
