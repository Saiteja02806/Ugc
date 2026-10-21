import type { NextConfig } from "next";

const firebaseAuthHelperDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_HELPER_DOMAIN ??
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Worker source keeps NodeNext .js imports; Webpack can also resolve its .ts source.
    extensionAlias: { ".js": [".js", ".ts"] },
  },
  outputFileTracingIncludes: {
    "/api/explore/emoji/**": ["./worker/src/assets/emoji/*.json.gz"],
    "/api/explore/hook-keyframe": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe"],
    "/api/explore/hook-starting-frame": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe"],
    "/api/audio/transfer": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe", "./node_modules/ffprobe-static/bin/linux/x64/ffprobe", "./node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe"],
    "/mcp": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/ffmpeg.exe", "./node_modules/ffprobe-static/bin/linux/x64/ffprobe", "./node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe"],
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
        hostname: "storage.googleapis.com",
        pathname: "/ugcsaas-media/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons",
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
