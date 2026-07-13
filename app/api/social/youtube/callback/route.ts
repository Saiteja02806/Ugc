import { handleSocialOAuthCallback } from "@/lib/social/oauth-callback";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handleSocialOAuthCallback(request, {
    platform: "youtube",
    provider: "google",
  });
}
