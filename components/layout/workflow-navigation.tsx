"use client";

import { Menu } from "lucide-react";
import { createContext, useContext, useId, useState, type ReactNode } from "react";

type NavigationState = { enabled: boolean; open: boolean; setOpen: (open: boolean) => void; id: string };
const NavigationContext = createContext<NavigationState | null>(null);

/** Workflow navigation is temporary; the user's saved sidebar preference stays intact. */
export function WorkflowNavigationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <NavigationContext.Provider value={{ enabled, open, setOpen, id }}>{children}</NavigationContext.Provider>;
}

export function useWorkflowNavigation() { return useContext(NavigationContext); }

export function WorkflowNavigationButton() {
  const navigation = useWorkflowNavigation();
  if (!navigation?.enabled) return null;
  return <button type="button" aria-label="Open navigation" aria-controls={navigation.id} aria-expanded={navigation.open} onClick={() => navigation.setOpen(true)} className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-card-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus md:inline-flex"><Menu className="size-4" aria-hidden="true" /></button>;
}
