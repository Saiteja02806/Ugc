import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/ugc-pilot-logo.png";

export function ProductLogoMark({
  className,
  imageClassName,
  sizes = "56px",
}: {
  className?: string;
  imageClassName?: string;
  sizes?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        alt=""
        width={426}
        height={283}
        sizes={sizes}
        unoptimized
        className={cn("h-auto w-full object-contain", imageClassName)}
      />
    </span>
  );
}
