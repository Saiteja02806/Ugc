import type { Metadata } from "next";
import localFont from "next/font/local";

import { TryUgcPilotDemo } from "@/components/marketing/try-ugcpilot-demo";

// Keep the demonstration's Wall-of-Text face independent from the main app
// typography. The legacy demo requested SF Pro/Inter, but SF Pro is not
// available on every platform; bundling the intended Inter Semibold fallback
// makes the reference treatment deterministic on Windows, macOS, and Vercel.
const tryUgcPilotWallText = localFont({
  src: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2",
  display: "swap",
  weight: "600",
  variable: "--font-try-ugcpilot-wall-text",
});

export const metadata: Metadata = {
  title: "Try UGCPilot",
  description: "Try the UGC Pilot Wall-of-Text content demonstration.",
};

export default function TryUgcPilotPage() {
  return (
    <div className={tryUgcPilotWallText.variable}>
      <TryUgcPilotDemo />
    </div>
  );
}
