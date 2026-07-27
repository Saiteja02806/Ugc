import type { Metadata } from "next";
import localFont from "next/font/local";

import { AuthProvider } from "@/contexts/auth-context";

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

export const metadata: Metadata = {
  title: {
    default: "UGC Pilot",
    template: "%s | UGC Pilot",
  },
  description:
    "Create, edit, schedule, and publish AI-assisted social videos and carousels for SaaS products and mobile apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${geistEditOverlay.variable} h-full`}
    >
      <body
        className={`${geistSans.className} min-h-full bg-background text-foreground antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
