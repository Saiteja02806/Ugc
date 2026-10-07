import Image from "next/image";

import logo from "@/public/brand/ugc-pilot-logo.png";

export function ConsentBrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
    >
      <Image
        src={logo}
        alt=""
        sizes="40px"
        unoptimized
        loading="eager"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
