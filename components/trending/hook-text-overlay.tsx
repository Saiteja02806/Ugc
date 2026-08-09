import {
  clampHookTextPosition,
  createHookTextLayout,
  getDefaultHookTextPosition,
  type HookTextLayout,
} from "@/lib/trending/hook-text-layout";
import {
  DEFAULT_TRENDING_TEXT_COLOR,
  type TrendingTextColor,
} from "@/lib/trending/text-color";
import { cn } from "@/lib/utils";

type HookTextOverlayProps = {
  className?: string;
  color?: TrendingTextColor;
  fontSize?: number;
  lines?: readonly string[] | null;
  position?: { x: number; y: number } | null;
  size?: "card" | "compact" | "review";
  text?: string | null;
};

export function HookTextOverlay({
  className,
  color = DEFAULT_TRENDING_TEXT_COLOR,
  fontSize,
  lines,
  position,
  size = "card",
  text,
}: HookTextOverlayProps) {
  const layout = getPreviewLayout({ fontSize, lines, text });

  if (!layout) {
    return null;
  }

  const resolvedPosition = clampHookTextPosition(
    position ?? getDefaultHookTextPosition(layout.positionBounds),
    layout.positionBounds,
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 [container-type:inline-size]",
        className,
      )}
    >
      <p
        data-overlay-size={size}
        style={{
          color,
          fontFamily:
            'var(--font-edit-overlay), "Noto Sans CJK SC", "Noto Sans CJK JP", sans-serif',
          fontSize: `${layout.fontSize / 10.8}cqw`,
          left: `${resolvedPosition.x * 100}%`,
          lineHeight: 1,
          textShadow: "0.185185cqw 0.185185cqw 0 rgba(0, 0, 0, 0.45)",
          top: `${resolvedPosition.y * 100}%`,
          width: `${layout.containerWidth / 10.8}cqw`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 text-center font-semibold tracking-normal"
      >
        {layout.lines.map((line, index) => (
          <span
            key={`${index}:${line}`}
            className="block whitespace-nowrap"
            style={
              index > 0
                ? { marginTop: `${layout.lineSpacing / 10.8}cqw` }
                : undefined
            }
          >
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

function getPreviewLayout(params: {
  fontSize: number | undefined;
  lines: readonly string[] | null | undefined;
  text: string | null | undefined;
}): HookTextLayout | null {
  const text = params.text?.trim() || params.lines?.join(" ").trim() || "";

  if (!text) return null;

  try {
    return createHookTextLayout(text, {
      enforceMaximum: false,
      enforceMinimum: false,
      ...(params.fontSize === undefined ? {} : { fontSize: params.fontSize }),
      ...(params.lines && params.lines.length > 0
        ? { lines: params.lines }
        : {}),
    });
  } catch {
    try {
      return createHookTextLayout(text, {
        enforceMaximum: false,
        enforceMinimum: false,
      });
    } catch {
      return null;
    }
  }
}
