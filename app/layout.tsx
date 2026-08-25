import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";

import { GoogleAuthRedirectHandler } from "@/components/auth/google-auth-redirect-handler";
import { AuthProvider } from "@/contexts/auth-context";
import { JobQueryProvider } from "@/components/providers/job-query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WorkspaceRouteBoundary } from "@/components/layout/workspace-route-boundary";
import {
  THEME_BACKGROUND_COLORS,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

import "./globals.css";

const geistSans = localFont({
  src: [
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Italic[wght].woff2",
      style: "italic",
      weight: "100 900",
    },
  ],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  display: "swap",
  variable: "--font-geist-mono",
});

// The worker registers this exact static face before rasterizing overlays.
// Loading the matching browser asset keeps preview glyph metrics stable across
// hydration and avoids the bare-family fallback that previously rendered serif.
const geistEditOverlay = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2",
  display: "swap",
  variable: "--font-edit-overlay",
  weight: "600",
});

const interWallText = localFont({
  src: "../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
  display: "swap",
  variable: "--font-wall-text",
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "UGC Pilot",
    template: "%s | UGC Pilot",
  },
  description:
    "Create Instagram Reel hooks, text-led videos, carousel posts, and approved publishing workflows in one focused workspace.",
};

const RETIRED_GLOBAL_CONTENT_STORAGE_KEYS = [
  "ugc-studio.carousel-library.v1",
  "ugc-studio.schedule-drafts.v1",
  "ugc-studio.editable-videos.v1",
] as const;

const retiredContentStorageCleanupScript = `(() => {
  try {
    for (const key of ${JSON.stringify(RETIRED_GLOBAL_CONTENT_STORAGE_KEYS)}) {
      window.localStorage.removeItem(key);
    }
  } catch {}
})();`;

const themeInitializationScript = `(() => {
  const themeBackgroundColors = ${JSON.stringify(THEME_BACKGROUND_COLORS)};

  try {
    const savedTheme = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const theme = savedTheme === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.backgroundColor = themeBackgroundColors[theme];
  } catch {
    const root = document.documentElement;
    root.classList.add("dark");
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
    root.style.backgroundColor = themeBackgroundColors.dark;
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${geistEditOverlay.variable} ${interWallText.variable} h-full dark`}
      data-theme="dark"
      style={{
        backgroundColor: THEME_BACKGROUND_COLORS.dark,
        colorScheme: "dark",
      }}
      suppressHydrationWarning
    >
      <head>
        <script
          id="ugc-pilot-theme"
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body
        className={`${geistSans.className} min-h-full bg-background text-foreground antialiased`}
      >
        <Script
          id="ugc-pilot-retired-content-storage-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: retiredContentStorageCleanupScript,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthRedirectHandler />
            <JobQueryProvider>
              <WorkspaceRouteBoundary>{children}</WorkspaceRouteBoundary>
            </JobQueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
