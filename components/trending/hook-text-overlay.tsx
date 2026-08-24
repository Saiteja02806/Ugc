import {
  clampHookTextPosition,
  createHookTextLayout,
  getDefaultHookTextPosition,
  HOOK_TEXT_BROWSER_FONT_FAMILY,
  HOOK_TEXT_FONT_WEIGHT,
  HOOK_TEXT_OUTLINE_COLOR,
  HOOK_TEXT_OUTLINE_WIDTH,
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
          fontFamily: HOOK_TEXT_BROWSER_FONT_FAMILY,
          fontSize: `${layout.fontSize / 10.8}cqw`,
          fontWeight: HOOK_TEXT_FONT_WEIGHT,
          left: `${resolvedPosition.x * 100}%`,
          lineHeight: 1,
          paintOrder: "stroke fill",
          top: `${resolvedPosition.y * 100}%`,
          WebkitTextStroke: `${HOOK_TEXT_OUTLINE_WIDTH / 10.8}cqw ${HOOK_TEXT_OUTLINE_COLOR}`,
          width: `${layout.containerWidth / 10.8}cqw`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 text-center tracking-normal"
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
  const savedLines = params.lines?.filter((line) => line.trim()) ?? [];
  const hasSavedLayout =
    params.fontSize !== undefined || savedLines.length > 0;

  if (!text) return null;

  if (hasSavedLayout) {
    if (params.fontSize === undefined || savedLines.length === 0) {
      return null;
    }

    try {
      return createHookTextLayout(text, {
        enforceMaximum: false,
        enforceMinimum: false,
        fontSize: params.fontSize,
        lines: savedLines,
      });
    } catch {
      return null;
    }
  }

  try {
    return createHookTextLayout(text, {
      enforceMaximum: false,
      enforceMinimum: false,
    });
  } catch {
    return null;
  }
}
