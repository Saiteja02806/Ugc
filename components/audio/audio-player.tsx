"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Headphones, LoaderCircle, Radio, Trash2 } from "lucide-react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { AudioAsset } from "@/lib/audio/types";

export function AudioPlayer({ asset, liveRequestId, userId, onRemove, removing }: { asset: AudioAsset | null; liveRequestId: string | null; userId: string; onRemove: (id: string) => void; removing: boolean }) {
  const audio = useRef<HTMLAudioElement>(null); const active = useRef<AbortController | null>(null); const urlRef = useRef<string | null>(null); const playWhenReady = useRef(false);
  const [url, setUrl] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  function clear() { active.current?.abort(); active.current = null; if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
  useEffect(() => { return () => { active.current?.abort(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, []);
  async function load(download = false) {
    if (!asset) return; if (!download) clear(); const controller = new AbortController(); active.current = controller; setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(userId);
      const response = await fetch(`/api/audio/assets/${asset.id}${download ? "?download=1" : ""}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok) throw new Error("This recording could not be loaded.");
      const objectUrl = URL.createObjectURL(await response.blob());
      if (controller.signal.aborted) { URL.revokeObjectURL(objectUrl); return; }
      if (download) {
        const link = document.createElement("a"); link.href = objectUrl; const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "audio.mp3"; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else { urlRef.current = objectUrl; playWhenReady.current = true; setUrl(objectUrl); }
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Audio could not be loaded."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function listenLive() {
    if (!liveRequestId) return;
    if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported("audio/mpeg")) { setError("Live playback is unavailable in this browser. Your saved recording will be ready shortly."); return; }
    clear(); const controller = new AbortController(); active.current = controller; setBusy(true); setError(null);
    const source = new MediaSource(); const objectUrl = URL.createObjectURL(source); urlRef.current = objectUrl; setUrl(objectUrl);
    try {
      await new Promise<void>((resolve, reject) => { source.addEventListener("sourceopen", () => resolve(), { once: true }); controller.signal.addEventListener("abort", () => reject(new Error("Playback stopped.")), { once: true }); });
      if (controller.signal.aborted) return;
      const buffer = source.addSourceBuffer("audio/mpeg"); const token = await getCurrentUserIdToken(userId);
      const response = await fetch(`/api/audio/generations/${liveRequestId}/stream`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("Live playback could not start. Your generation will continue saving.");
      const reader = response.body.getReader(); let played = false;
      try {
        while (!controller.signal.aborted) {
          const part = await reader.read(); if (part.done) break;
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => { buffer.removeEventListener("updateend", done); buffer.removeEventListener("error", failed); controller.signal.removeEventListener("abort", failed); };
            const done = () => { cleanup(); resolve(); }; const failed = () => { cleanup(); reject(new Error("Live playback interrupted. The saved recording will remain available.")); };
            buffer.addEventListener("updateend", done, { once: true }); buffer.addEventListener("error", failed, { once: true }); controller.signal.addEventListener("abort", failed, { once: true });
            try { buffer.appendBuffer(part.value as Uint8Array<ArrayBuffer>); } catch { failed(); }
          });
          if (!played) { played = true; void audio.current?.play().catch(() => undefined); }
        }
        if (source.readyState === "open" && !buffer.updating) source.endOfStream();
      } finally { await reader.cancel().catch(() => undefined); }
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Live playback is unavailable. Wait for the saved recording."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="audio-player">
    <div className="audio-player-heading"><Headphones size={16} aria-hidden="true" />{asset?.name || (liveRequestId ? "Your speech is being generated" : "Audio preview")}</div>
    {url ? <audio ref={audio} src={url} controls preload="metadata" aria-label="Audio preview" onCanPlay={() => { if (playWhenReady.current) { playWhenReady.current = false; void audio.current?.play().catch(() => setError("Press play to listen to this recording.")); } }} /> : <p className="audio-player-placeholder">{asset ? "Play this recording or download a copy." : liveRequestId ? "Listen as it arrives, or wait for the saved recording." : "Your generated speech will appear here."}</p>}
    <div className="audio-player-controls">
      {asset ? <><button type="button" className="audio-text-button" disabled={busy} onClick={() => void load()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Headphones size={15} />}Play recording</button><button type="button" className="audio-text-button" disabled={busy} onClick={() => void load(true)}><Download size={15} />Download</button><button type="button" className="audio-text-button" disabled={busy || removing} onClick={() => onRemove(asset.id)}><Trash2 size={15} />Remove recording</button></> : liveRequestId ? <button type="button" className="audio-text-button" disabled={busy} onClick={() => void listenLive()}><Radio size={15} />{busy ? "Listening live…" : "Listen live"}</button> : null}
    </div>
    {asset?.testOnly ? <p className="audio-player-attribution">Free-plan test audio · Noncommercial use. Made with <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">ElevenLabs</a>.</p> : null}
    {error ? <p role="alert" className="audio-player-error">{error}</p> : null}
  </div>;
}
