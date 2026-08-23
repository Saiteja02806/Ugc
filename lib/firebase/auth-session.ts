export const AUTH_SESSION_COOKIE_NAME = "ugc_session";

export function hasAuthSessionCookie(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .some((cookie) => cookie.trim() === `${AUTH_SESSION_COOKIE_NAME}=1`);
}
