"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DomainMoveNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  if (params.get("moved") !== "1") {
    return null;
  }

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete("moved");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-50 flex justify-center px-3">
      <p
        role="status"
        className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 text-sm font-medium text-foreground-strong shadow-floating"
      >
        <span>getugcpilot.com is now vidmake.io.</span>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-control px-2 py-1 text-xs font-semibold text-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Dismiss
        </button>
      </p>
    </div>
  );
}
