"use client";

import { useState } from "react";
import { Images, Music2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLibraryBrowser } from "./image-library-browser";
import { MusicLibraryManager } from "./music-library-manager";
import styles from "./image-library.module.css";

export function MediaLibraryPanel({ initialTab = "images" }: { initialTab?: "images" | "music" }) {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"images" | "music">(initialTab);
  if (loading) return <p role="status">Loading your library…</p>;
  if (!user) return <p>Sign in to manage your library.</p>;
  return <div className="space-y-4"><div role="group" aria-label="Library media type" className={styles.actions}>
    <Button type="button" variant={tab === "images" ? "secondary" : "outline"} aria-pressed={tab === "images"} onClick={() => setTab("images")}><Images aria-hidden="true" />Images</Button>
    <Button type="button" variant={tab === "music" ? "secondary" : "outline"} aria-pressed={tab === "music"} onClick={() => setTab("music")}><Music2 aria-hidden="true" />Music</Button>
  </div><div hidden={tab !== "images"}><ImageLibraryBrowser key={`images:${user.uid}`} owner={user.uid} /></div><div hidden={tab !== "music"}>{tab === "music" ? <MusicLibraryManager key={`music:${user.uid}`} owner={user.uid} /> : null}</div></div>;
}

export function MediaLibraryButton({ label = "Library", variant = "outline", disabled = false, className, initialTab = "images" }: { label?: string; variant?: "outline" | "creative-edit"; disabled?: boolean; className?: string; initialTab?: "images" | "music" }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  return <><Button type="button" variant={variant} size={variant === "creative-edit" ? "creative-edit" : "sm"} disabled={disabled || loading || !user} className={className} onClick={() => setOpen(true)}><Images aria-hidden="true" /><span>{label}</span></Button>
    {open && user ? <Dialog open onOpenChange={setOpen}><DialogContent className={styles.dialog}><DialogHeader><DialogTitle>Media library</DialogTitle><DialogDescription>Manage images, background collections and music for reuse.</DialogDescription></DialogHeader><div className={styles.dialogBody}><MediaLibraryPanel key={user.uid} initialTab={initialTab} /></div></DialogContent></Dialog> : null}</>;
}
