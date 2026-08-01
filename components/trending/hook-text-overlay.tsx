import { cn } from "@/lib/utils";

type HookTextOverlayProps = {
  className?: string;
  fontSize?: number;
  lines?: readonly string[] | null;
  size?: "card" | "compact" | "review";
  text?: string | null;
};

export function HookTextOverlay({
  className,
  fontSize = 52,
  lines,
  size = "card",
  text,
}: HookTextOverlayProps) {
  const semanticLines = normalizeLines(lines, text);

  if (semanticLines.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center [container-type:inline-size]",
        className,
      )}
    >
      <p
        style={{
          fontSize: `${(clampFontSize(fontSize) / 1080) * 100}cqw`,
        }}
        className={cn(
          "w-[84%] text-center font-semibold leading-[1.269] tracking-[-0.012em] text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.95),0_2px_8px_rgb(0_0_0_/_0.55)]",
          size === "compact" &&
            "[text-shadow:0_1px_2px_rgb(0_0_0_/_0.95),0_1px_5px_rgb(0_0_0_/_0.55)]",
        )}
      >
        {semanticLines.map((line, index) => (
          <span
            key={`${index}:${line}`}
            className="block whitespace-nowrap"
          >
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

function clampFontSize(value: number) {
  return Number.isFinite(value)
    ? Math.min(52, Math.max(34, value))
    : 52;
}

function normalizeLines(
  lines: readonly string[] | null | undefined,
  text: string | null | undefined,
) {
  const source =
    lines && lines.length > 0
      ? lines
      : text?.replace(/\r\n?/gu, "\n").split("\n") ?? [];

  return source
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}
