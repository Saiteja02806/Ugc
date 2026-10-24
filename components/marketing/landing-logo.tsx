import Image from "next/image";

import { cn } from "@/lib/utils";

export function LandingLogo({
  className,
  sizes = "28px",
}: {
  className?: string;
  sizes?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-block size-7 shrink-0", className)}>
      <Image
        src="/brand/ugc-pilot-icon-light-theme.png"
        alt=""
        width={1024}
        height={1024}
        sizes={sizes}
        unoptimized
        className="size-full object-contain dark:hidden"
      />
      <Image
        src="/brand/ugc-pilot-icon-dark-theme.png"
        alt=""
        width={1024}
        height={1024}
        sizes={sizes}
        unoptimized
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}
