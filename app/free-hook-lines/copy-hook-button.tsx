"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

export function CopyHookButton({ text, targetId }: { text: string; targetId: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      const element = document.getElementById(targetId);
      const selection = window.getSelection();
      if (element && selection) {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setStatus("error");
    }
  }

  return <span className={styles.copyControl}>
    <button type="button" className={styles.copyButton} onClick={copy} aria-label={`Copy hook: ${text}`}>
      {status === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {status === "copied" ? "Copied" : "Copy"}
    </button>
    <span className={status === "error" ? styles.copyError : styles.srOnly} role="status">
      {status === "copied" ? "Hook copied to clipboard." : status === "error" ? "Copy unavailable. The line is selected; copy it manually." : ""}
    </span>
  </span>;
}
