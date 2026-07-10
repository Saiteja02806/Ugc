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

export const metadata: Metadata = {
  title: {
    default: "UGC Studio",
    template: "%s | UGC Studio",
  },
  description: "Generate AI UGC ads for SaaS products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body
        className={`${geistSans.className} min-h-full bg-background text-foreground antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
