import Image from "next/image";

import { cn } from "@/lib/utils";

const MARK_SRC = "/brand/vidmake-mark.png";

export function ProductLogoMark({
  className,
  sizes = "28px",
}: {
  className?: string;
  sizes?: string;
  theme?: "auto" | "light" | "dark";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-7 shrink-0", className)}
    >
      <Image
        src={MARK_SRC}
        alt=""
        width={737}
        height={798}
        sizes={sizes}
        unoptimized
        className="size-full object-contain"
      />
    </span>
  );
}

export function ProductWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-brand-serif)] font-normal leading-none tracking-[-0.03em]",
        className,
      )}
    >
      Vidmake
    </span>
  );
}
