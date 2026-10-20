-- Widen the existing provider check without changing legacy operations or access policies.
ALTER TABLE public.generation_provider_operations
  DROP CONSTRAINT generation_provider_operations_provider_check,
  ADD CONSTRAINT generation_provider_operations_provider_check
  CHECK (provider = ANY (ARRAY['gemini', 'higgsfield', 'openai', 'openrouter', 'runway', 'veo']));
