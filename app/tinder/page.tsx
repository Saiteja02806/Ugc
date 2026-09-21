import type { Metadata } from "next";

const TINDER_DEMO_URL = "https://ugc-tinder-deck-ano542ohmq-uc.a.run.app/";

export const metadata: Metadata = {
  title: "Dating Swipe Demo",
  description: "Try the UGCPilot Tinder-style dating swipe demonstration.",
};

export default function TinderDemoPage() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#111111]">
      <iframe
        title="Tinder-style dating swipe demo"
        src={TINDER_DEMO_URL}
        className="block h-full w-full border-0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </main>
  );
}
