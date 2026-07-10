import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { AuthProvider } from "@/contexts/auth-context";

import "./globals.css";

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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body
        className={`${GeistSans.className} min-h-full bg-background text-foreground antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
