import type { NextConfig } from "next";
import landingPreviews from "./lib/marketing/landing-preview-assets.json";
import { nativeMediaTracing } from "./lib/build/native-media-tracing.ts";

const nativeMedia = nativeMediaTracing();
const landingPreviewPaths = [
  ...Object.values(landingPreviews.videos).flatMap((asset) => [asset.src, asset.poster]),
  ...Object.values(landingPreviews.slideshows).flatMap((asset) => asset.slides.map((slide) => slide.src)),
];

const firebaseAuthHelperDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_HELPER_DOMAIN ??
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // The package resolves its executable relative to its real installed module.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  experimental: {
    // Worker source keeps NodeNext .js imports; Webpack can also resolve its .ts source.
    extensionAlias: { ".js": [".js", ".ts"] },
  },
  outputFileTracingIncludes: {
    // Automation uses the shared glyph renderer on the server as well as workers.
    "/api/trending/slideshow-automation": ["./worker/src/assets/fonts/explore-text/*.ttf"],
    "/api/trending/slideshow-automation/**": ["./worker/src/assets/fonts/explore-text/*.ttf"],
    "/api/internal/carousels/replenish": ["./worker/src/assets/fonts/explore-text/*.ttf"],
    "/api/internal/trending/reconcile": ["./worker/src/assets/fonts/explore-text/*.ttf"],
    "/api/internal/jobs/recover": ["./worker/src/assets/fonts/explore-text/*.ttf"],
    "/api/explore/**": ["./lib/explore/creator-*.json.enc"],
    "/api/ai-studio/**": ["./lib/explore/creator-*.json.enc"],
    "/api/media/**": ["./lib/explore/creator-*.json.enc"],
    "/mcp": ["./lib/explore/creator-*.json.enc"],
    "/api/explore/slideshows/image": ["./lib/explore/creator-slideshow-media/*.enc"],
    "/api/explore/slideshows/reference-images": ["./lib/explore/creator-slideshow-media/*.enc"],
    "/api/explore/creator-slide-media/**": ["./lib/explore/creator-slideshow-media/*.enc"],
    "/api/explore/creator-slide-provider/**": ["./lib/explore/creator-slideshow-media/*.enc"],
    "/api/explore/creator-media/**": ["./lib/explore/creator-account-media/*.enc"],
    "/api/explore/creator-scene/**": ["./lib/explore/creator-account-media/*.png.enc"],
    "/api/explore/emoji/**": ["./worker/src/assets/emoji/*.json.gz"],
    "/api/explore/hook-keyframe": [...nativeMedia.ffmpegFiles, "./public/explore/talking-head-frames/v1/*.png", "./public/explore/curated-hook-frames/v1/*.png", "./lib/explore/creator-account-media/*.png.enc"],
    "/api/explore/hook-starting-frame": [...nativeMedia.ffmpegFiles, "./public/explore/talking-head-frames/v1/*.png", "./public/explore/curated-hook-frames/v1/*.png", "./lib/explore/creator-account-media/*.png.enc"],
    "/api/audio/transfer": nativeMedia.mediaFiles,
    // External native packages used by /mcp are traced from their imports.
    // A /mcp include glob also matches health/discovery routes in Next.
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
  outputFileTracingExcludes: {
    "/*": nativeMedia.otherProbeBinaries,
    // Next applies include globs with contains:true: /mcp also matches these
    // lightweight routes. They never execute a media decoder or probe.
    "/mcp/health": ["./node_modules/ffmpeg-static/**/*", "./node_modules/ffprobe-static/**/*"],
    "/.well-known/oauth-protected-resource/mcp": ["./node_modules/ffmpeg-static/**/*", "./node_modules/ffprobe-static/**/*"],
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
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  async headers() {
    // Only these content-hashed files are immutable. Existing mutable public
    // media keeps its current policy and URLs.
    return landingPreviewPaths.map((src) => ({
      source: src,
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }));
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
