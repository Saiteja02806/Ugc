import type { MetadataRoute } from "next";

const privatePaths = [
  "/api/",
  "/mcp-server",
  "/oauth/",
  "/e2e/",
  "/image-test",
  "/tinder",
  "/ai-studio",
  "/aivideos",
  "/analytics",
  "/audio-generation",
  "/auth/",
  "/avatars",
  "/connected-accounts",
  "/create-content",
  "/dashboard",
  "/demos",
  "/edit",
  "/explore",
  "/hookvideos",
  "/image-gen",
  "/library",
  "/onboarding",
  "/projects",
  "/scheduling",
  "/settings",
  "/sign-in",
  "/updates",
  "/verify-email",
  "/video-gen",
  "/viral",
];

const searchAgents = ["GPTBot", "ClaudeBot", "PerplexityBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      ...searchAgents.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: privatePaths,
      })),
    ],
    sitemap: "https://getugcpilot.com/sitemap.xml",
  };
}
