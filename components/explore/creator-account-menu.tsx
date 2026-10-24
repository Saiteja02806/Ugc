"use client";

import { Check, ChevronDown, UsersRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { CreatorAccount } from "@/lib/explore/creator-accounts";

export function CreatorAccountMenu({ accounts, selectedId, onSelect }: {
  accounts: CreatorAccount[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;
  function select(id: string | null) { onSelect(id); setOpen(false); }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" size="sm" variant="outline" />}>
      <UsersRound aria-hidden="true" />Recreate the account<ChevronDown aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent align="end" className="max-w-[calc(100vw-24px)]">
      <PopoverTitle className="px-2 py-1 text-xs text-muted">{accounts.length} creator accounts</PopoverTitle>
      <button type="button" aria-pressed={selectedId === null} onClick={() => select(null)} className="flex min-h-11 items-center justify-between rounded-md px-2 text-left hover:bg-card-muted focus-visible:outline-2 focus-visible:outline-focus">
        All references{selectedId === null ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
      </button>
      {accounts.map(account => <button key={account.id} type="button" aria-pressed={selectedId === account.id} onClick={() => select(account.id)} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-left hover:bg-card-muted focus-visible:outline-2 focus-visible:outline-focus">
        <span>{account.label}<span className="ml-2 text-xs text-muted">{account.items.length} {account.items[0]?.format === "slideshow" ? "slideshows" : "videos"}</span></span>
        {selectedId === account.id ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
      </button>)}
    </PopoverContent>
  </Popover>;
}
