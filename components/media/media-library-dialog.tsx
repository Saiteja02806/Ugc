"use client";

import { useRef, useState } from "react";
import { Images, Music2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLibraryBrowser } from "./image-library-browser";
import { MusicLibraryManager } from "./music-library-manager";
import styles from "./image-library.module.css";

export function MediaLibraryPanel({ initialTab = "images", onBusyChange }: { initialTab?: "images" | "music"; onBusyChange?: (busy: boolean) => void }) {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"images" | "music">(initialTab);
  const [visitedMusic, setVisitedMusic] = useState(initialTab === "music");
  const [busy, setBusy] = useState(false);
  const pending = useRef(new Set<string>());
  function trackBusy(kind: string, next: boolean) {
    if (next) pending.current.add(kind); else pending.current.delete(kind);
    const active = pending.current.size > 0; setBusy(active); onBusyChange?.(active);
  }
  if (loading) return <p role="status">Loading your library…</p>;
  if (!user) return <p>Sign in to manage your library.</p>;
  return <div className="space-y-4"><div role="group" aria-label="Library media type" className={styles.actions}>
    <Button type="button" disabled={busy} variant={tab === "images" ? "secondary" : "outline"} aria-pressed={tab === "images"} onClick={() => setTab("images")}><Images aria-hidden="true" />Images</Button>
    <Button type="button" disabled={busy} variant={tab === "music" ? "secondary" : "outline"} aria-pressed={tab === "music"} onClick={() => { setVisitedMusic(true); setTab("music"); }}><Music2 aria-hidden="true" />Music</Button>
  </div><div hidden={tab !== "images"}><ImageLibraryBrowser key={`images:${user.uid}`} owner={user.uid} onBusyChange={next => trackBusy("images", next)} /></div><div hidden={tab !== "music"}>{visitedMusic ? <MusicLibraryManager key={`music:${user.uid}`} owner={user.uid} active={tab === "music"} onBusyChange={next => trackBusy("music", next)} /> : null}</div>{busy ? <p role="status" className="text-xs text-muted">Keep this library open until the upload or update finishes.</p> : null}</div>;
}

export function MediaLibraryButton({ label = "Library", variant = "outline", disabled = false, className, initialTab = "images" }: { label?: string; variant?: "outline" | "creative-edit"; disabled?: boolean; className?: string; initialTab?: "images" | "music" }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <><Button type="button" variant={variant} size={variant === "creative-edit" ? "creative-edit" : "sm"} disabled={disabled || loading || !user} className={className} onClick={() => setOpen(true)}><Images aria-hidden="true" /><span>{label}</span></Button>
    {open && user ? <Dialog open onOpenChange={next => { if (!busy) setOpen(next); }}><DialogContent className={styles.dialog} showCloseButton={!busy}><DialogHeader><DialogTitle>Media library</DialogTitle><DialogDescription>Manage images, background collections and music for reuse.</DialogDescription></DialogHeader><div className={styles.dialogBody}><MediaLibraryPanel key={user.uid} initialTab={initialTab} onBusyChange={setBusy} /></div></DialogContent></Dialog> : null}</>;
}
