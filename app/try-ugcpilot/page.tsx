import type { Metadata } from "next";

import { TryUgcPilotDemo } from "@/components/marketing/try-ugcpilot-demo";

export const metadata: Metadata = {
  title: "Try UGCPilot",
  description: "Try the UGC Pilot Wall-of-Text content demonstration.",
};

export default function TryUgcPilotPage() {
  return <TryUgcPilotDemo />;
}
