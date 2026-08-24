import type { NextConfig } from "next";

const firebaseAuthHelperDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_HELPER_DOMAIN ??
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/viral/:path*",
        destination: "/dashboard",
        permanent: false,
      },
    ];
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
