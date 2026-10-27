import type { Metadata } from "next";
import { HookVideoBundle } from "@/components/marketing/hook-video-bundle";

export const metadata: Metadata = {
  title: "Hook Video Library — Batch 1",
  description: "Download 104 public Hook reference videos in one ZIP. No signup; limited to 100 downloads.",
  alternates: { canonical: "/hook-video-bundle" },
  robots: { index: false, follow: true },
};
export default function HookVideoBundlePage() { return <HookVideoBundle />; }
