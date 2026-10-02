import Image from "next/image";

import { cn } from "@/lib/utils";

export function CreditIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/credits.png"
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      draggable={false}
      className={cn("size-4 shrink-0 object-contain", className)}
    />
  );
}
