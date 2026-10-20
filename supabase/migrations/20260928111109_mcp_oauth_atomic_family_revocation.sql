-- Refresh and disconnect serialize on the same token-family advisory lock.
-- Both functions use a separate read before taking the lock, then read again
-- inside it so a revocation committed while waiting cannot be missed.
CREATE OR REPLACE FUNCTION public.mcp_rotate_refresh_token(
  old_hash text,
  new_refresh_hash text,
  new_access_hash text,
  expected_client_id text,
  expected_resource text
) RETURNS TABLE(firebase_uid text, scopes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  family_to_lock uuid;
  previous public.mcp_oauth_tokens%ROWTYPE;
BEGIN
  SELECT family_id INTO family_to_lock FROM public.mcp_oauth_tokens
    WHERE token_hash = old_hash AND token_type = 'refresh';
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('mcp_oauth_family'),
    pg_catalog.hashtext(family_to_lock::text)
  );
  SELECT * INTO previous FROM public.mcp_oauth_tokens
    WHERE token_hash = old_hash AND token_type = 'refresh' FOR UPDATE;
  IF NOT FOUND OR previous.client_id <> expected_client_id OR
     previous.resource <> expected_resource OR previous.expires_at <= now() THEN
    RETURN;
  END IF;
  IF previous.revoked_at IS NOT NULL THEN
    UPDATE public.mcp_oauth_tokens SET revoked_at = now()
      WHERE family_id = previous.family_id AND revoked_at IS NULL;
    RETURN;
  END IF;
  UPDATE public.mcp_oauth_tokens SET revoked_at = now() WHERE token_hash = old_hash;
  INSERT INTO public.mcp_oauth_tokens
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, family_id, expires_at)
  VALUES
    (new_refresh_hash, 'refresh', previous.client_id, previous.firebase_uid,
      previous.resource, previous.scopes, previous.family_id, now() + interval '30 days'),
    (new_access_hash, 'access', previous.client_id, previous.firebase_uid,
      previous.resource, previous.scopes, previous.family_id, now() + interval '1 hour');
  firebase_uid := previous.firebase_uid;
  scopes := previous.scopes;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text)
  TO service_role;

CREATE FUNCTION public.mcp_revoke_token_family(
  provided_token_hash text,
  expected_client_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  family_to_lock uuid;
  actual_client_id text;
BEGIN
  SELECT family_id, client_id INTO family_to_lock, actual_client_id
    FROM public.mcp_oauth_tokens WHERE token_hash = provided_token_hash;
  IF NOT FOUND OR actual_client_id <> expected_client_id THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('mcp_oauth_family'),
    pg_catalog.hashtext(family_to_lock::text)
  );
  -- Token rows are immutable except for revocation; recheck after waiting.
  SELECT client_id INTO actual_client_id FROM public.mcp_oauth_tokens
    WHERE token_hash = provided_token_hash AND family_id = family_to_lock;
  IF NOT FOUND OR actual_client_id <> expected_client_id THEN RETURN false; END IF;
  UPDATE public.mcp_oauth_tokens SET revoked_at = now()
    WHERE family_id = family_to_lock AND revoked_at IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_revoke_token_family(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_revoke_token_family(text,text)
  TO service_role;
