"use client";

import { cloneElement, createContext, useContext, useEffect, useId, useRef, type ComponentProps, type ReactElement, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { DialogContent } from "@/components/ui/dialog";
import styles from "./format-person-image-picker.module.css";

const PickerContext = createContext<{ open: boolean; change: (open: boolean) => void; id: string; trigger: RefObject<HTMLButtonElement | null> } | null>(null);

/** Disclosure in the existing preparation surface; no portal or nested dialog. */
export function InlinePhotoPicker({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), previousOpen = useRef(open);
  useEffect(() => {
    if (previousOpen.current && !open) trigger.current?.focus({ preventScroll: true });
    previousOpen.current = open;
  }, [open]);
  return <PickerContext value={{ open, change: onOpenChange, id, trigger }}><div className={styles.inlineRoot} data-inline-photo-picker>{children}</div></PickerContext>;
}

export function InlinePhotoPickerTrigger({ render, children }: { render: ReactElement<ComponentProps<typeof Button>>; children: ReactNode }) {
  const state = useContext(PickerContext)!;
  return cloneElement(render, { ref: state.trigger, "aria-expanded": state.open, "aria-controls": state.id, onClick: () => state.change(!state.open), children });
}

export function InlinePhotoPickerContent({ children, ref }: ComponentProps<typeof DialogContent>) {
  const state = useContext(PickerContext)!;
  return state.open ? <div ref={ref} id={state.id} role="region" aria-label="Choose person photos" className={styles.inlineContent}>{children}</div> : null;
}
