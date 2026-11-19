"use client";

import { useEffect, useRef, useState } from "react";
import { WorkflowBackgroundAudioPicker, HOOK_BACKGROUND_AUDIO_SOURCES } from "@/components/explore/workflow-background-audio-picker";
import type { BackgroundAudioLibrary } from "@/lib/explore/background-audio-types";

const hookTracks = [
  { id: "hook_audio_001", source: "hook" as const, name: "Hook track 01", durationSeconds: 28.6, moods: ["curious", "serious"], energy: "medium", loopable: false },
  { id: "hook_audio_002", source: "hook" as const, name: "Hook track 02", durationSeconds: 43.2, moods: ["uplifting"], energy: "high", loopable: true },
  { id: "hook_audio_003", source: "hook" as const, name: "Hook track 03", durationSeconds: 35.1, moods: ["calm"], energy: "low", loopable: false },
  { id: "hook_audio_004", source: "hook" as const, name: "Hook track 04", durationSeconds: 51.8, moods: ["playful"], energy: "high", loopable: true },
  { id: "hook_audio_005", source: "hook" as const, name: "Hook track 05", durationSeconds: 24.4, moods: ["urgent"], energy: "high", loopable: false },
];
const wallTracks = [
  { id: "audio_006_segment_01", source: "wall" as const, name: "Wall track 06 · Segment 1", durationSeconds: 18.9, moods: ["curious"], energy: "medium", loopable: false },
  { id: "audio_006_segment_02", source: "wall" as const, name: "Wall track 06 · Segment 2", durationSeconds: 21.3, moods: ["serious"], energy: "medium", loopable: false },
  { id: "audio_007_segment_01", source: "wall" as const, name: "Wall track 07 · Segment 1", durationSeconds: 26.7, moods: ["urgent"], energy: "high", loopable: true },
  { id: "audio_008", source: "wall" as const, name: "Wall · a longer catalogue name that should truncate cleanly", durationSeconds: 44.0, moods: ["calm", "uplifting"], energy: "low", loopable: false },
];
const library: BackgroundAudioLibrary = { tracks: [...hookTracks, ...wallTracks] };

const attachment = {
  loading: false, error: null, clearError() {}, remove() {},
  choose: async () => true, chooseRemote: async () => true,
} as never;

function Section({ title, subtitle, sources }: { title: string; subtitle: string; sources?: readonly ("hook" | "wall")[] }) {
  return <section className="space-y-2 rounded-xl border border-border bg-card p-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="text-xs leading-5 text-muted">{subtitle}</p>
    <div className="flex flex-wrap gap-2">
      <WorkflowBackgroundAudioPicker ownerId="edit-render-e2e" attachment={attachment} onChoose={async () => true} sources={sources} />
    </div>
  </section>;
}

export function AudioLibraryPreview() {
  const [ready, setReady] = useState(false);
  const original = useRef<typeof window.fetch>(null);
  useEffect(() => {
    original.current = window.fetch;
    const respond = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", ...headers } });
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/api/explore/background-audio?") || url.endsWith("/api/explore/background-audio")) return respond(library);
      if (url.includes("/api/explore/background-audio/file")) {
        // A minimal silent MP3 frame keeps preview clicks working without any provider call.
        const silent = new Uint8Array([255, 251, 144, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return new Response(silent, { status: 200, headers: { "Content-Type": "audio/mpeg", "X-Explore-Music-Loopable": "false" } });
      }
      return original.current!(input as never, init);
    };
    setReady(true);
    return () => { window.fetch = original.current!; setReady(false); };
  }, []);
  return <main className="mx-auto max-w-3xl space-y-6 p-8" data-ready={ready}>
    <header><h1 className="text-lg font-semibold">Audio library preview</h1>
      <p className="text-xs leading-5 text-muted">Isolated dev-only page. No provider call, no credits, nothing saved.</p></header>
    <Section title="Hook video · Talking head" subtitle="sources=[&quot;hook&quot;] — the curated Hook catalogue only (new filter)." sources={HOOK_BACKGROUND_AUDIO_SOURCES} />
    <Section title="Text on screen · Phone" subtitle="No sources filter — today's combined Hook + Wall list (unchanged surfaces)." />
  </main>;
}
