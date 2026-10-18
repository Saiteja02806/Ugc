-- An MCP access token remains opaque and contains no email or Firebase bearer
-- token. Preserve the verified-email decision made at OAuth consent so the
-- MCP can apply the same TikTok/YouTube eligibility policy as the website.
-- Existing token families are deliberately unverified until the account gives
-- fresh consent; a migration must never upgrade an old credential implicitly.
ALTER TABLE public.mcp_oauth_authorization_codes
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

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
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, email_verified, family_id, expires_at)
  VALUES
    (new_refresh_hash, 'refresh', previous.client_id, previous.firebase_uid,
      previous.resource, previous.scopes, previous.email_verified, previous.family_id, now() + interval '30 days'),
    (new_access_hash, 'access', previous.client_id, previous.firebase_uid,
      previous.resource, previous.scopes, previous.email_verified, previous.family_id, now() + interval '1 hour');
  firebase_uid := previous.firebase_uid;
  scopes := previous.scopes;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_exchange_authorization_code(
  authorization_code_hash text,
  expected_client_id text,
  expected_redirect_uri text,
  expected_resource text,
  expected_code_challenge text,
  new_access_hash text,
  new_refresh_hash text,
  new_family_id uuid
) RETURNS TABLE(scopes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE auth_code public.mcp_oauth_authorization_codes%ROWTYPE;
BEGIN
  SELECT * INTO auth_code FROM public.mcp_oauth_authorization_codes
    WHERE code_hash = authorization_code_hash FOR UPDATE;
  IF NOT FOUND OR auth_code.used_at IS NOT NULL OR
     auth_code.expires_at <= now() OR
     auth_code.client_id <> expected_client_id OR
     auth_code.redirect_uri <> expected_redirect_uri OR
     auth_code.resource <> expected_resource OR
     auth_code.code_challenge <> expected_code_challenge THEN
    RETURN;
  END IF;
  UPDATE public.mcp_oauth_authorization_codes SET used_at = now()
    WHERE code_hash = authorization_code_hash;
  INSERT INTO public.mcp_oauth_tokens
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, email_verified, family_id, expires_at)
  VALUES
    (new_access_hash, 'access', auth_code.client_id, auth_code.firebase_uid,
      auth_code.resource, auth_code.scopes, auth_code.email_verified, new_family_id, now() + interval '1 hour'),
    (new_refresh_hash, 'refresh', auth_code.client_id, auth_code.firebase_uid,
      auth_code.resource, auth_code.scopes, auth_code.email_verified, new_family_id, now() + interval '30 days');
  scopes := auth_code.scopes;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)
  TO service_role;
