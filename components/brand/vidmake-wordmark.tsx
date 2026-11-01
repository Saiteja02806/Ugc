import { cn } from "@/lib/utils";

import styles from "./vidmake-wordmark.module.css";

type VidmakeWordmarkProps = {
  className?: string;
  play?: "loop" | "once" | "settled";
  variant?: "full" | "header";
};

export function VidmakeWordmark({
  className,
  play = "settled",
  variant = "header",
}: VidmakeWordmarkProps) {
  const label = variant === "full" ? "vidmake.io" : "vidmake";

  return (
    <span
      className={cn(styles.mark, className)}
      data-variant={variant}
      data-play={play}
      role="img"
      aria-label={label}
    >
      <span className={styles.slot} aria-hidden="true">
        <svg className={styles.icon} viewBox="0 0 10 12" fill="currentColor">
          <polygon points="1,1 9,6 1,11" />
        </svg>
        <span className={styles.letter}>v</span>
      </span>
      <span className={styles.rest} aria-hidden="true">
        idmake{variant === "full" ? ".io" : null}
      </span>
    </span>
  );
}
