"use client";

import { Children, isValidElement, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./workflow-feedback.module.css";

const subscribe = () => () => {};
const clientHost = () => document.body;
const serverHost = () => null;

function feedbackText(children: ReactNode): string {
  return Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child)
    : isValidElement<{ children?: ReactNode }>(child) ? feedbackText(child.props.children) : "").join(" ");
}

/** Show feedback outside the editor's layout; dismissal never clears a request. */
export function WorkflowFeedback({ id, children, active = true }: { id: string; children: ReactNode; active?: boolean }) {
  const host = useSyncExternalStore(subscribe, clientHost, serverHost);
  const message = feedbackText(children);
  return <>
    <span id={id} className="sr-only">{message}</span>
    {active && host && message.trim() ? createPortal(<FeedbackNotice key={message} id={id}>{children}</FeedbackNotice>, host) : null}
  </>;
}

function FeedbackNotice({ id, children }: { id: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <aside data-workflow-feedback data-feedback-id={id} aria-label="Workflow status" className={`${styles.notice} app-canvas`}>
    <div className={styles.closeRow}><button type="button" className={styles.close} onClick={() => setDismissed(true)} aria-label="Dismiss workflow notification" title="Dismiss notification"><X aria-hidden="true" className="size-4" /></button></div>
    <div className={styles.content}>{children}</div>
  </aside>;
}
