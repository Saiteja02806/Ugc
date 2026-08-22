import type { Metadata } from "next";

import { ViralWorkspace } from "@/components/viral/viral-workspace";

export const metadata: Metadata = {
  title: "Explore",
};

export default function ViralPage() {
  return <ViralWorkspace />;
}
