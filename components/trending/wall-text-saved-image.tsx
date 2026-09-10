"use client";

import { useEffect, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

export function WallTextSavedImage({ assignmentId, creativeId, revision, text, draft }: {
  assignmentId: string; creativeId: string; revision: number; text: string;
  draft?: { fullText: string; textColor: string; textBox: { x: number; y: number; width: number; height: number } };
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; url?: string; error?: string } | null>(null);
  const draftBody = draft ? JSON.stringify(draft) : undefined;
  const key = `${assignmentId}:${creativeId}:${revision}:${text}:${draftBody ?? ""}`;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      for (let retry = 0; retry < 3; retry++) {
        try {
          const token = await getCurrentUserIdToken();
          if (controller.signal.aborted) return;
          if (!token) throw new Error("Sign in to load this text.");
          const endpoint = `/api/trending/creatives/wall_text/${encodeURIComponent(creativeId)}/overlay?assignmentId=${encodeURIComponent(assignmentId)}&revision=${revision}`;
          const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, ...(draftBody ? { "Content-Type": "application/json" } : {}) },
            method: draftBody ? "POST" : "GET", body: draftBody,
            signal: controller.signal, cache: "no-store" });
          if (!response.ok) {
            if (response.status < 500 && response.status !== 429) retry = 2;
            throw new Error(response.status === 409 ? "Text changed. Refresh this feed." : "Text could not load.");
          }
          const bytes = await response.arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
            .map(value => value.toString(16).padStart(2, "0")).join("");
          if (hash !== response.headers.get("X-Overlay-Sha256")) throw new Error("Text image verification failed.");
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
          const image = new Image(); image.src = objectUrl; await image.decode();
          if (image.naturalWidth !== 1080 || image.naturalHeight !== 1920) throw new Error("Invalid text image dimensions.");
          if (!controller.signal.aborted) setResult({ key, url: objectUrl });
          return;
        } catch (error) {
          if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
          if (controller.signal.aborted) return;
          if (retry === 2) {
            setResult({ key, error: error instanceof Error ? error.message : "Text could not load." });
            return;
          }
          await new Promise<void>(resolve => { timer = setTimeout(resolve, 500 * (retry + 1));
            controller.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
        }
      }
    }
    timer = setTimeout(() => { void load(); }, draftBody ? 400 : 0);
    return () => { controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assignmentId, creativeId, revision, text, key, attempt, draftBody]);
  const current = result?.key === key ? result : null;
  return current?.url ? (
    // This must remain a full-canvas asset: applying text-box sizing would scale it twice.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={current.url} alt={text} draggable={false} data-wall-text-renderer="shared-png-v1"
      className="pointer-events-none absolute inset-0 z-20 size-full object-contain" />
  ) : (
    <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 p-4 text-center text-sm text-white">
      <span>{current?.error ?? "Preparing text preview…"}</span>
      {current?.error ? <button type="button" onPointerDown={e => e.stopPropagation()}
        onClick={() => { setResult(null); setAttempt(value => value + 1); }} className="rounded border px-3 py-1">Retry</button> : null}
    </div>
  );
}
