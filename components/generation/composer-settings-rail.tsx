"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Keep existing setting controls mounted and reachable at every pane width. */
export function ComposerSettingsRail({ children }: { children: ReactNode }) {
  const id = useId();
  const rail = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ overflow: false, end: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setPosition({ overflow: element.scrollWidth > element.clientWidth + 1, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [children]);
  return <div className="flex min-w-0 flex-1 items-center gap-1">
    <div ref={rail} id={id} role="group" aria-label="Generation settings" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
      {children}
    </div>
    {position.overflow ? <Button type="button" variant="ghost" size="icon-sm" className="size-7 shrink-0 rounded-full" aria-controls={id} aria-label={position.end ? "Previous settings" : "More settings"}
      onClick={() => rail.current?.scrollBy({ left: position.end ? -rail.current.scrollLeft : Math.max(100, rail.current.clientWidth * 0.8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
      {position.end ? <ChevronLeft className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
    </Button> : null}
  </div>;
}
