"use client";

import { Component, lazy, Suspense, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
const createWorkspace = () => lazy(() => preloadHookStartingFrameWorkspace().then(module => ({ default: module.HookStartingFrameWorkspace })));

// Suspense handles a pending import, not its rejection. Keep an opening failure
// inside this screen instead of replacing the entire workflow with app/error.
class OpeningBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("Starting-frame workspace could not open", error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Show an immediate, dismissible response while the preparation bundle loads. */
export function LazyHookStartingFrameWorkspace(props: ComponentProps<typeof HookStartingFrameWorkspace>) {
  const title = useRef<HTMLHeadingElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  // React.lazy remembers a rejected promise. A retry needs a new lazy type as
  // well as another import; remounting the same type would immediately throw.
  const [Workspace, setWorkspace] = useState(createWorkspace);
  const retry = () => { workspaceImport = null; setWorkspace(() => createWorkspace()); setAttempt(value => value + 1); };
  const recovery = <div role="alert" className="p-6">
    <p>The starting-frame screen could not be opened. Your saved preparation is unchanged.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={retry}>Retry opening</Button>
      <Button type="button" variant="ghost" onClick={props.onClose}>Back to references</Button>
    </div>
  </div>;
  const opening = <p role="status" className={styles.openingStatus}><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Opening your starting frame…</p>;
  const shell = (content: ReactNode) => props.presentation === "workspace" ? content : <Dialog open onOpenChange={open => { if (!open) props.onClose(); }}>
    <DialogContent className={`${styles.dialog} ${props.presentation === "recreation" ? styles.recreationDialog : ""}`} initialFocus={title}>
      <header className={styles.header}>
        <DialogTitle ref={title} tabIndex={-1} className={styles.title}>Create your starting frame</DialogTitle>
        <DialogDescription>Keep the scene. Choose your person. Review the image before making a video.</DialogDescription>
      </header>
      {content}
    </DialogContent>
  </Dialog>;
  return <OpeningBoundary key={attempt} fallback={shell(recovery)}>
    <Suspense fallback={shell(props.presentation === "workspace" ? <p role="status" className="p-6">Opening your starting frame…</p> : opening)}><Workspace {...props} /></Suspense>
  </OpeningBoundary>;
}
