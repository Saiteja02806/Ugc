import { handleSocialOAuthCallback } from "@/lib/social/oauth-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleSocialOAuthCallback(request, {
    platform: "instagram",
    provider: "meta",
  });
}
