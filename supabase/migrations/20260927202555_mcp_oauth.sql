-- MCP OAuth records are accessible only to trusted server code using service_role.
-- Existing Firebase UIDs remain the account identifiers; these tables do not
-- introduce a second user database.
CREATE TABLE public.mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  registration_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mcp_oauth_authorization_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL,
  firebase_uid text NOT NULL,
  redirect_uri text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mcp_oauth_tokens (
  token_hash text PRIMARY KEY,
  token_type text NOT NULL CHECK (token_type IN ('access', 'refresh')),
  client_id text NOT NULL,
  firebase_uid text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mcp_oauth_consents (
  firebase_uid text NOT NULL,
  client_id text NOT NULL,
  scopes text[] NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firebase_uid, client_id)
);

CREATE INDEX mcp_oauth_authorization_codes_expiry_idx
  ON public.mcp_oauth_authorization_codes (expires_at);
CREATE INDEX mcp_oauth_clients_registration_rate_idx
  ON public.mcp_oauth_clients (registration_ip_hash, created_at);
CREATE INDEX mcp_oauth_tokens_user_client_idx
  ON public.mcp_oauth_tokens (firebase_uid, client_id);
CREATE INDEX mcp_oauth_tokens_expiry_idx
  ON public.mcp_oauth_tokens (expires_at);

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mcp_oauth_clients FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mcp_oauth_authorization_codes FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mcp_oauth_tokens FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mcp_oauth_consents FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_oauth_clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_oauth_authorization_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_oauth_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_oauth_consents TO service_role;

-- Rotate a refresh token and mint its replacement in one transaction.
-- A replay revokes the entire token family.
CREATE FUNCTION public.mcp_rotate_refresh_token(
  old_hash text,
  new_refresh_hash text,
  new_access_hash text,
  expected_client_id text,
  expected_resource text
) RETURNS TABLE(firebase_uid text, scopes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous public.mcp_oauth_tokens%ROWTYPE;
BEGIN
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
REVOKE ALL ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_rotate_refresh_token(text,text,text,text,text) TO service_role;

-- Verify and consume an authorization code while issuing both tokens in the
-- same transaction. A failed token insert leaves the code available to retry.
CREATE FUNCTION public.mcp_exchange_authorization_code(
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
    (token_hash, token_type, client_id, firebase_uid, resource, scopes, family_id, expires_at)
  VALUES
    (new_access_hash, 'access', auth_code.client_id, auth_code.firebase_uid,
      auth_code.resource, auth_code.scopes, new_family_id, now() + interval '1 hour'),
    (new_refresh_hash, 'refresh', auth_code.client_id, auth_code.firebase_uid,
      auth_code.resource, auth_code.scopes, new_family_id, now() + interval '30 days');
  scopes := auth_code.scopes;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_exchange_authorization_code(text,text,text,text,text,text,text,uuid)
  TO service_role;

-- Serialize registrations for each source IP so concurrent requests cannot
-- exceed the hourly limit through a count/insert race.
CREATE FUNCTION public.mcp_register_client(
  new_client_id text,
  new_client_name text,
  new_redirect_uris text[],
  ip_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recent_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(ip_hash));
  SELECT count(*) INTO recent_count FROM public.mcp_oauth_clients
    WHERE registration_ip_hash = ip_hash
      AND created_at >= now() - interval '1 hour';
  IF recent_count >= 20 THEN
    RETURN false;
  END IF;
  INSERT INTO public.mcp_oauth_clients
    (client_id, client_name, redirect_uris, registration_ip_hash)
  VALUES (new_client_id, new_client_name, new_redirect_uris, ip_hash);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_register_client(text,text,text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_register_client(text,text,text[],text) TO service_role;
