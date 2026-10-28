"use client";

import { lazy, Suspense, useRef, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { HookStartingFrameWorkspace } from "./hook-starting-frame-workspace";
import styles from "./hook-starting-frame-workspace.module.css";

let workspaceImport: Promise<typeof import("./hook-starting-frame-workspace")> | null = null;
/** Warm code only on user intent; this never reads photos or submits a job. */
export function preloadHookStartingFrameWorkspace() {
  return workspaceImport ??= import("./hook-starting-frame-workspace").catch(error => {
    workspaceImport = null;
    throw error;
  });
}
const Workspace = lazy(() => preloadHookStartingFrameWorkspace().then(module => ({ default: module.HookStartingFrameWorkspace })));

/** Show an immediate, dismissible response while the preparation bundle loads. */
export function LazyHookStartingFrameWorkspace(props: ComponentProps<typeof HookStartingFrameWorkspace>) {
  const title = useRef<HTMLHeadingElement | null>(null);
  const fallback = props.presentation === "workspace" ? <p role="status" className="p-6">Opening your starting frame…</p> : <Dialog open onOpenChange={open => { if (!open) props.onClose(); }}>
    <DialogContent className={`${styles.dialog} ${props.presentation === "recreation" ? styles.recreationDialog : ""}`} initialFocus={title}>
      <header className={styles.header}>
        <DialogTitle ref={title} tabIndex={-1} className={styles.title}>Create your starting frame</DialogTitle>
        <DialogDescription>Keep the scene. Choose your person. Review the image before making a video.</DialogDescription>
      </header>
      <p role="status" className={styles.openingStatus}><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Opening your starting frame…</p>
    </DialogContent>
  </Dialog>;
  return <Suspense fallback={fallback}><Workspace {...props} /></Suspense>;
}
