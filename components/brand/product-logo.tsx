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

export function ProductWordmark({
  className,
  variant = "display",
}: {
  className?: string;
  variant?: "display" | "ui";
}) {
  return (
    <span
      style={{ fontFamily: '"Vidmake DM Sans", sans-serif' }}
      className={cn(
        variant === "ui"
          ? "text-[18px] font-medium leading-none tracking-[-0.02em]"
          : "font-medium leading-none tracking-[-0.02em]",
        className,
      )}
    >
      Vidmake
    </span>
  );
}
