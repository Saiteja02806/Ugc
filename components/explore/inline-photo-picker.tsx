"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import styles from "./format-person-image-picker.module.css";

/** Anchored, non-modal library: opening it never expands the preparation page. */
export function InlinePhotoPicker({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <Popover open={open} onOpenChange={onOpenChange}><div className={styles.inlineRoot} data-inline-photo-picker>{children}</div></Popover>;
}

export function InlinePhotoPickerTrigger({ render, children }: { render: ReactElement<ComponentProps<typeof Button>>; children: ReactNode }) {
  return <PopoverTrigger render={render}>{children}</PopoverTrigger>;
}

export function InlinePhotoPickerContent({ children, ref }: ComponentProps<typeof DialogContent>) {
  return <PopoverContent ref={ref} align="start" side="bottom" sideOffset={8} initialFocus={false} aria-label="Photo library" className={styles.inlineContent}>{children}</PopoverContent>;
}
