import type { NextConfig } from "next";

const firebaseAuthHelperDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_HELPER_DOMAIN ??
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/api/trending/**": ["./worker/src/assets/fonts/*.ttf", "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2"],
    "/api/scheduling/**": ["./worker/src/assets/fonts/*.ttf", "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2"],
    "/api/internal/jobs/prepare-wall-text": [
      "./lib/trending/fonts/avenir-next-demi-bold.ttf",
      "./lib/trending/fonts/arial-bold.ttf",
      "./lib/trending/fonts/arial-regular.ttf",
      "./lib/trending/fonts/inter-variable.ttf",
      "./fontconfig/fonts.conf",
    ],
    "/api/trending/creatives/*": [
      "./lib/trending/fonts/avenir-next-demi-bold.ttf",
      "./lib/trending/fonts/arial-bold.ttf",
      "./lib/trending/fonts/arial-regular.ttf",
      "./lib/trending/fonts/inter-variable.ttf",
      "./fontconfig/fonts.conf",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    if (!firebaseAuthHelperDomain) {
      return [];
    }

    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${firebaseAuthHelperDomain}/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${firebaseAuthHelperDomain}/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
