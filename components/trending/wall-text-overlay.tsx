import type { CSSProperties } from "react";

import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";
import { getWallTextRenderBlocks } from "@/lib/trending/wall-text-types";
import {
  getWallTextFontSize,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_SECTION_GAP,
} from "@/lib/trending/wall-text-visual-style";
import {
  DEFAULT_TRENDING_TEXT_COLOR,
  type TrendingTextColor,
} from "@/lib/trending/text-color";

export function WallTextOverlay({
  content,
  layout,
  textColor = DEFAULT_TRENDING_TEXT_COLOR,
}: {
  content: TrendingWallTextContent;
  layout: TrendingWallTextLayout;
  textColor?: TrendingTextColor;
}) {
  const textBoxStyle = {
    height: `${layout.textBox.height * 100}%`,
    left: `${layout.textBox.x * 100}%`,
    top: `${layout.textBox.y * 100}%`,
    width: `${layout.textBox.width * 100}%`,
  } satisfies CSSProperties;
  const fontSize = getWallTextFontSize(content);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [container-type:inline-size]"
    >
      <div
        className="absolute flex flex-col justify-center overflow-visible text-center"
        style={{
          ...textBoxStyle,
          color: textColor,
          fontFamily:
            "var(--font-wall-text), Inter, Arial, 'Helvetica Neue', sans-serif",
          fontSize: `${fontSize / 10.8}cqw`,
          fontWeight: 700,
          letterSpacing: `${-0.2 / 10.8}cqw`,
          paintOrder: "stroke fill",
          textShadow:
            "0 0.185185cqw 0.277778cqw rgb(0 0 0 / 0.55)",
          WebkitTextStroke: `${WALL_TEXT_OUTLINE_WIDTH / 10.8}cqw #000000`,
        }}
      >
        {getWallTextRenderBlocks(content).map((segment, segmentIndex) => (
          <p
            key={`${segment.role}-${segmentIndex}`}
            className="m-0 whitespace-nowrap"
            style={{
              lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR,
              marginTop:
                segmentIndex === 0
                  ? 0
                  : `${WALL_TEXT_SECTION_GAP / 10.8}cqw`,
            }}
          >
            {segment.lines.map((line, lineIndex) => (
              <span
                key={`${lineIndex}-${line}`}
                className="block"
              >
                {line}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
